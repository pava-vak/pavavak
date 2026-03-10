const express = require('express');
const router  = express.Router();
const prisma = require('../lib/prisma'); // shared singleton — prevents connection pool exhaustion
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { sendToUser } = require('../lib/firebaseAdmin');
const WIRE_PREFIX = '__pvk_v1__:';
const MAX_MEDIA_BYTES = Number(process.env.MAX_MEDIA_BYTES || 8 * 1024 * 1024);

function decodeWirePayload(content) {
    if (!content || typeof content !== 'string' || !content.startsWith(WIRE_PREFIX)) return null;
    try {
        const raw = Buffer.from(content.slice(WIRE_PREFIX.length), 'base64').toString('utf8');
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function encodeWirePayload(obj) {
    const raw = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
    return WIRE_PREFIX + raw;
}

function parseInlineImage(content) {
    const wire = decodeWirePayload(content);
    if (!wire || wire.t !== 'chat' || !wire.imageBase64) return null;
    try {
        const imageBytes = Buffer.from(wire.imageBase64, 'base64');
        if (!imageBytes || !imageBytes.length) return null;
        return { wire, imageBytes };
    } catch (_) {
        return null;
    }
}

// ─── HELPER: verify connection between two users ──────────────
async function getConnection(userId1, userId2) {
    return prisma.connections.findFirst({
        where: {
            OR: [
                { user1_id: userId1, user2_id: userId2, status: 'active' },
                { user1_id: userId2, user2_id: userId1, status: 'active' }
            ]
        }
    });
}

async function isAdminUser(userId) {
    const user = await prisma.users.findUnique({
        where: { user_id: userId },
        select: { is_admin: true }
    });
    return !!user?.is_admin;
}

async function logSystemEvent(action, details, metadata = null) {
    try {
        await prisma.system_logs.create({
            data: {
                level: 'INFO',
                action,
                event_type: action,
                details,
                metadata: metadata ? JSON.stringify(metadata) : null,
                logged_at: new Date()
            }
        });
    } catch (_) {
        // best-effort logging; do not break request flow
    }
}

router.get('/media/:mediaId', isAuthenticated, async (req, res) => {
    try {
        const mediaId = parseInt(req.params.mediaId, 10);
        if (!Number.isFinite(mediaId) || mediaId <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid mediaId' });
        }

        const media = await prisma.media_assets.findUnique({
            where: { media_id: mediaId },
            select: {
                media_id: true,
                sender_id: true,
                receiver_id: true,
                mime_type: true,
                preview_bytes: true,
                content_bytes: true
            }
        });

        if (!media) {
            return res.status(404).json({ success: false, error: 'Media not found' });
        }

        const userId = req.user.user_id;
        const canView = !!req.user.is_admin || media.sender_id === userId || media.receiver_id === userId;
        if (!canView) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const variant = (req.query.variant || 'preview').toString().toLowerCase();
        const payload = variant === 'full' ? media.content_bytes : (media.preview_bytes || media.content_bytes);

        res.set('Content-Type', media.mime_type || 'application/octet-stream');
        res.set('Cache-Control', 'no-store');
        return res.send(Buffer.from(payload));
    } catch (error) {
        console.error('Get media error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch media' });
    }
});
// ════════════════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════════════════
router.post('/send', isAuthenticated, async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.user_id;
        const receiver = parseInt(receiverId, 10);

        if (!Number.isFinite(receiver) || !content || !content.trim()) {
            return res.status(400).json({ success: false, error: 'receiverId and content required' });
        }

        const connection = await getConnection(senderId, receiver);
        if (!connection) {
            return res.status(403).json({ success: false, error: 'Not connected to this user' });
        }

        const io = req.app.get('io');
        const onlineUsers = req.app.get('onlineUsers');
        const isReceiverOnline = !!(onlineUsers && onlineUsers.has(receiver));

        const parsedMedia = parseInlineImage(content.trim());
        let messageContent = content.trim();

        const message = await prisma.$transaction(async (tx) => {
            const created = await tx.messages.create({
                data: {
                    sender_id: senderId,
                    receiver_id: receiver,
                    content: messageContent,
                    is_read: false,
                    delivered_at: isReceiverOnline ? new Date() : null
                }
            });

            if (parsedMedia) {
                if (parsedMedia.imageBytes.length > MAX_MEDIA_BYTES) {
                    throw new Error('MEDIA_TOO_LARGE');
                }

                const media = await tx.media_assets.create({
                    data: {
                        message_id: created.message_id,
                        sender_id: senderId,
                        receiver_id: receiver,
                        mime_type: 'image/jpeg',
                        byte_size: parsedMedia.imageBytes.length,
                        preview_bytes: parsedMedia.imageBytes,
                        content_bytes: parsedMedia.imageBytes
                    }
                });

                const wire = {
                    t: 'chat',
                    text: parsedMedia.wire.text || null,
                    replyPreview: parsedMedia.wire.replyPreview || null,
                    mediaId: media.media_id,
                    mediaMime: media.mime_type
                };
                messageContent = encodeWirePayload(wire);

                return tx.messages.update({
                    where: { message_id: created.message_id },
                    data: { content: messageContent }
                });
            }

            return created;
        });

        if (io) {
            io.to(`user_${receiver}`).emit('new_message', {
                messageId: message.message_id,
                senderId: message.sender_id,
                receiverId: message.receiver_id,
                content: message.content,
                sentAt: message.sent_at,
                isRead: message.is_read,
                isDelivered: !!message.delivered_at,
                deliveredAt: message.delivered_at,
                editedAt: message.edited_at,
                isEdited: !!message.edited_at
            });

            if (isReceiverOnline) {
                io.to(`user_${senderId}`).emit('message_delivered', {
                    messageId: message.message_id,
                    deliveredAt: message.delivered_at || new Date()
                });
            }
        }

        sendToUser(prisma, receiver, {
            type: 'new_message',
            messageId: message.message_id,
            senderId: message.sender_id,
            chatUserId: message.sender_id
        }).catch((e) => {
            console.error('[FCM] sendToUser failed:', e.message);
        });

        res.json({
            success: true,
            message: {
                messageId: message.message_id,
                senderId: message.sender_id,
                receiverId: message.receiver_id,
                content: message.content,
                sentAt: message.sent_at,
                isRead: message.is_read,
                isDelivered: !!message.delivered_at,
                deliveredAt: message.delivered_at,
                editedAt: message.edited_at,
                isEdited: !!message.edited_at
            }
        });
    } catch (error) {
        if (error && error.message === 'MEDIA_TOO_LARGE') {
            return res.status(413).json({ success: false, error: 'Image too large' });
        }
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});
// GET CONVERSATIONS LIST
// NOTE: must be defined BEFORE /:userId route in Express
// ════════════════════════════════════════════════════════════
router.get('/conversations/list', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const onlineUsers = req.app.get('onlineUsers');

        const connections = await prisma.connections.findMany({
            where: {
                OR: [
                    { user1_id: userId, status: 'active' },
                    { user2_id: userId, status: 'active' }
                ]
            },
            include: {
                user1: { select: { user_id: true, username: true, full_name: true } },
                user2: { select: { user_id: true, username: true, full_name: true } }
            }
        });

        const conversations = await Promise.all(
            connections.map(async (conn) => {
                const otherUser = conn.user1_id === userId ? conn.user2 : conn.user1;

                // Last message visible to this user (not deleted on their side)
                const lastMessage = await prisma.messages.findFirst({
                    where: {
                        OR: [
                            {
                                sender_id:          userId,
                                receiver_id:        otherUser.user_id,
                                deleted_for_sender: false
                            },
                            {
                                sender_id:            otherUser.user_id,
                                receiver_id:          userId,
                                deleted_for_receiver: false
                            }
                        ]
                    },
                    orderBy: { sent_at: 'desc' }
                });

                const unreadCount = await prisma.messages.count({
                    where: {
                        sender_id:            otherUser.user_id,
                        receiver_id:          userId,
                        is_read:              false,
                        deleted_for_receiver: false
                    }
                });

                return {
                    user: {
                        userId:   otherUser.user_id,
                        username: otherUser.username,
                        fullName: otherUser.full_name
                    },
                    lastMessage: lastMessage ? {
                        content:  lastMessage.content,
                        sentAt:   lastMessage.sent_at,
                        isFromMe: lastMessage.sender_id === userId,
                        isRead: lastMessage.is_read,
                        // Delivery is not persisted yet; infer from read/receiver-online.
                        isDelivered: !!lastMessage.delivered_at || lastMessage.is_read,
                        deliveredAt: lastMessage.delivered_at,
                        editedAt: lastMessage.edited_at,
                        isEdited: !!lastMessage.edited_at
                    } : null,
                    unreadCount
                };
            })
        );

        conversations.sort((a, b) => {
            if (!a.lastMessage && !b.lastMessage) return 0;
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.sentAt) - new Date(a.lastMessage.sentAt);
        });

        res.json({ success: true, conversations });
    } catch (error) {
        console.error('Conversations list error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
    }
});

// ════════════════════════════════════════════════════════════
// GET CONVERSATION WITH USER
// ════════════════════════════════════════════════════════════
router.get('/:userId', isAuthenticated, async (req, res) => {
    try {
        const currentUserId = req.user.user_id;
        const otherUserId   = parseInt(req.params.userId);

        const connection = await getConnection(currentUserId, otherUserId);
        if (!connection) {
            return res.status(403).json({ success: false, error: 'Not connected to this user' });
        }

        const visibleWhere = {
            where: {
                OR: [
                    {
                        sender_id:          currentUserId,
                        receiver_id:        otherUserId,
                        deleted_for_sender: false
                    },
                    {
                        sender_id:            otherUserId,
                        receiver_id:          currentUserId,
                        deleted_for_receiver: false
                    }
                ]
            },
            orderBy: { sent_at: 'asc' }
        };

        // Persist delivery when receiver loads chat (reliable delivered state).
        const newlyDelivered = await prisma.messages.findMany({
            where: {
                sender_id: otherUserId,
                receiver_id: currentUserId,
                delivered_at: null,
                deleted_for_receiver: false
            },
            select: { message_id: true, sender_id: true }
        });

        if (newlyDelivered.length > 0) {
            const ids = newlyDelivered.map((m) => m.message_id);
            await prisma.messages.updateMany({
                where: { message_id: { in: ids } },
                data: { delivered_at: new Date() }
            });

            const io = req.app.get('io');
            if (io) {
                newlyDelivered.forEach((m) => {
                    io.to(`user_${m.sender_id}`).emit('message_delivered', {
                        messageId: m.message_id,
                        deliveredAt: new Date()
                    });
                });
            }
        }

        // Exclude messages soft-deleted for this user's side
        const messages = await prisma.messages.findMany(visibleWhere);

        const formattedMessages = messages.map(msg => ({
            messageId:   msg.message_id,
            senderId:    msg.sender_id,
            receiverId:  msg.receiver_id,
            content:     msg.content,
            sentAt:      msg.sent_at,
            isRead:      msg.is_read,
            readAt:      msg.read_at,
            isDelivered: !!msg.delivered_at || msg.is_read,
            deliveredAt: msg.delivered_at,
            editedAt: msg.edited_at,
            isEdited: !!msg.edited_at
        }));

        res.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
    }
});

// ════════════════════════════════════════════════════════════
// MARK MESSAGE AS READ
// ════════════════════════════════════════════════════════════
router.put('/:messageId/read', isAuthenticated, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const userId    = req.user.user_id;

        const message = await prisma.messages.findUnique({
            where: { message_id: messageId }
        });

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }
        if (message.receiver_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const now = new Date();
        await prisma.messages.update({
            where: { message_id: messageId },
            data:  { is_read: true, read_at: now, delivered_at: message.delivered_at || now }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${message.sender_id}`).emit('message_read', {
                messageId,
                readAt: now
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, error: 'Failed to mark as read' });
    }
});

router.put('/:userId/read-all', isAuthenticated, async (req, res) => {
    try {
        const currentUserId = req.user.user_id;
        const otherUserId = parseInt(req.params.userId, 10);

        if (!Number.isFinite(otherUserId) || otherUserId <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid userId' });
        }

        const connection = await getConnection(currentUserId, otherUserId);
        if (!connection) {
            return res.status(403).json({ success: false, error: 'Not connected to this user' });
        }

        const unreadMessages = await prisma.messages.findMany({
            where: {
                sender_id: otherUserId,
                receiver_id: currentUserId,
                is_read: false,
                deleted_for_receiver: false
            },
            select: { message_id: true }
        });

        if (unreadMessages.length === 0) {
            return res.json({ success: true, updatedCount: 0 });
        }

        const now = new Date();
        const messageIds = unreadMessages.map((m) => m.message_id);

        await prisma.messages.updateMany({
            where: { message_id: { in: messageIds } },
            data: {
                is_read: true,
                read_at: now,
                delivered_at: now
            }
        });

        const io = req.app.get('io');
        if (io) {
            messageIds.forEach((messageId) => {
                io.to(`user_${otherUserId}`).emit('message_read', {
                    messageId,
                    readAt: now
                });
            });
        }

        return res.json({ success: true, updatedCount: messageIds.length });
    } catch (error) {
        console.error('Mark conversation read error:', error);
        return res.status(500).json({ success: false, error: 'Failed to mark conversation as read' });
    }
});

router.put('/:messageId/edit', isAuthenticated, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId, 10);
        const userId = req.user.user_id;
        const newText = (req.body.content || '').toString().trim();

        if (!Number.isFinite(messageId) || messageId <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid messageId' });
        }
        if (!newText) {
            return res.status(400).json({ success: false, error: 'content required' });
        }

        const message = await prisma.messages.findUnique({
            where: { message_id: messageId }
        });
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }
        if (message.sender_id !== userId) {
            return res.status(403).json({ success: false, error: 'Only sender can edit' });
        }

        const wire = decodeWirePayload(message.content);
        if (wire && wire.t === 'chat') {
            wire.text = newText;
        }
        const nextContent = wire && wire.t === 'chat' ? encodeWirePayload(wire) : newText;
        const editedAt = new Date();

        const updated = await prisma.messages.update({
            where: { message_id: messageId },
            data: {
                content: nextContent,
                edited_at: editedAt,
                edit_count: { increment: 1 }
            }
        });

        const io = req.app.get('io');
        if (io) {
            const payload = {
                messageId: updated.message_id,
                content: updated.content,
                editedAt
            };
            io.to(`user_${updated.sender_id}`).emit('message_edited', payload);
            io.to(`user_${updated.receiver_id}`).emit('message_edited', payload);
        }

        return res.json({
            success: true,
            message: {
                messageId: updated.message_id,
                content: updated.content,
                editedAt: updated.edited_at,
                isEdited: !!updated.edited_at
            }
        });
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ success: false, error: 'Failed to edit message' });
    }
});

// ════════════════════════════════════════════════════════════
// ADMIN: GET ALL MESSAGES IN A CONVERSATION (read-only view)
// Returns messages between any two users for admin inspection.
// Content visible to admin — message encryption (future) will
// make this impossible. For now admin sees plaintext.
// ════════════════════════════════════════════════════════════
router.get('/admin/conversation/:userId1/:userId2', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userId1 = parseInt(req.params.userId1);
        const userId2 = parseInt(req.params.userId2);

        const messages = await prisma.messages.findMany({
            where: {
                OR: [
                    { sender_id: userId1, receiver_id: userId2 },
                    { sender_id: userId2, receiver_id: userId1 }
                ]
            },
            include: {
                sender: { select: { full_name: true, username: true } }
            },
            orderBy: { sent_at: 'asc' }
        });

        const formatted = messages.map(msg => ({
            messageId:  msg.message_id,
            senderId:   msg.sender_id,
            receiverId: msg.receiver_id,
            senderName: msg.sender.full_name || msg.sender.username,
            content:    msg.content,
            sentAt:     msg.sent_at,
            isRead:     msg.is_read
        }));

        res.json({ success: true, messages: formatted });
    } catch (error) {
        console.error('Admin get conversation error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
    }
});



// ════════════════════════════════════════════════════════════
// ADMIN: LIST ALL CONNECTIONS (for admin messages tab)
// Returns all user pairs that have an active connection.
// ════════════════════════════════════════════════════════════
router.get('/admin/connections/all', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const connections = await prisma.connections.findMany({
            where: { status: 'active' },
            include: {
                user1: { select: { user_id: true, full_name: true, username: true } },
                user2: { select: { user_id: true, full_name: true, username: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        const formatted = connections.map(c => ({
            connectionId: c.connection_id,
            user1Id:      c.user1_id,
            user2Id:      c.user2_id,
            user1Name:    c.user1.full_name || c.user1.username,
            user2Name:    c.user2.full_name || c.user2.username
        }));

        res.json({ success: true, connections: formatted });
    } catch (error) {
        console.error('Admin list connections error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch connections' });
    }
});

// ════════════════════════════════════════════════════════════
// ADMIN: DELETE SINGLE MESSAGE (hard delete — gone for everyone)
// ════════════════════════════════════════════════════════════
router.delete('/admin/:messageId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const scopeRaw = (req.query.scope || 'all').toString().toLowerCase();
        const scope = (scopeRaw === 'sender' || scopeRaw === 'receiver') ? scopeRaw : 'all';

        const message = await prisma.messages.findUnique({
            where: { message_id: messageId }
        });
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        const io = req.app.get('io');
        if (scope === 'all') {
            await prisma.messages.delete({ where: { message_id: messageId } });

            if (io) {
                io.to(`user_${message.sender_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: true
                });
                io.to(`user_${message.receiver_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: true
                });
            }

            await logSystemEvent(
                'ADMIN_MESSAGE_DELETE',
                `Admin ${req.user.user_id} deleted message ${messageId} for all`,
                { adminId: req.user.user_id, messageId, scope: 'all', senderId: message.sender_id, receiverId: message.receiver_id }
            );
            return res.json({ success: true, scope: 'all' });
        }

        const senderIsAdmin = await isAdminUser(message.sender_id);
        const receiverIsAdmin = await isAdminUser(message.receiver_id);
        if (!senderIsAdmin && !receiverIsAdmin) {
            await logSystemEvent(
                'ADMIN_MESSAGE_DELETE_REJECTED',
                `Admin ${req.user.user_id} attempted scoped delete on non-admin conversation`,
                { adminId: req.user.user_id, messageId, scope, senderId: message.sender_id, receiverId: message.receiver_id }
            );
            return res.status(400).json({
                success: false,
                error: 'sender/receiver scope is only allowed when one participant is admin'
            });
        }

        if (scope === 'sender') {
            await prisma.messages.update({
                where: { message_id: messageId },
                data: { deleted_for_sender: true }
            });
            if (io) {
                io.to(`user_${message.sender_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: false,
                    scope: 'sender'
                });
            }
        } else {
            await prisma.messages.update({
                where: { message_id: messageId },
                data: { deleted_for_receiver: true }
            });
            if (io) {
                io.to(`user_${message.receiver_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: false,
                    scope: 'receiver'
                });
            }
        }

        await logSystemEvent(
            'ADMIN_MESSAGE_DELETE',
            `Admin ${req.user.user_id} deleted message ${messageId} for ${scope}`,
            { adminId: req.user.user_id, messageId, scope, senderId: message.sender_id, receiverId: message.receiver_id }
        );
        res.json({ success: true, scope });
    } catch (error) {
        console.error('Admin delete message error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete message' });
    }
});

// ════════════════════════════════════════════════════════════
// ADMIN: DELETE ENTIRE CONVERSATION (hard delete — gone for both)
// ════════════════════════════════════════════════════════════
router.delete('/admin/conversation/:userId1/:userId2', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const userId1 = parseInt(req.params.userId1);
        const userId2 = parseInt(req.params.userId2);

        const deleted = await prisma.messages.deleteMany({
            where: {
                OR: [
                    { sender_id: userId1, receiver_id: userId2 },
                    { sender_id: userId2, receiver_id: userId1 }
                ]
            }
        });

        // Notify both users to clear their chat
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId1}`).emit('chat_cleared', { otherUserId: userId2 });
            io.to(`user_${userId2}`).emit('chat_cleared', { otherUserId: userId1 });
        }

        res.json({ success: true, deletedCount: deleted.count });
    } catch (error) {
        console.error('Admin delete conversation error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete conversation' });
    }
});



// ════════════════════════════════════════════════════════════
// USER: DELETE SINGLE MESSAGE (soft delete — my side only)
// ════════════════════════════════════════════════════════════
// - Sender deletes → sets deleted_for_sender = true
// - Receiver deletes → sets deleted_for_receiver = true
// - Other side is completely unaffected — still sees the message
// - Socket event sent only to the deleting user's session
router.delete('/:messageId', isAuthenticated, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const userId    = req.user.user_id;
        const scopeRaw  = (req.query.scope || 'all').toString().toLowerCase();
        let scope       = scopeRaw === 'me' ? 'me' : 'all';

        const message = await prisma.messages.findUnique({
            where: { message_id: messageId }
        });

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        const isSender   = message.sender_id   === userId;
        const isReceiver = message.receiver_id === userId;

        if (!isSender && !isReceiver) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const senderIsAdmin = await isAdminUser(message.sender_id);
        const receiverIsAdmin = await isAdminUser(message.receiver_id);
        const isAdminConversation = senderIsAdmin || receiverIsAdmin;

        const io = req.app.get('io');
        // Rule: in admin-involved chats, non-admin delete must never remove admin copy.
        // User can press "delete for all", but backend applies requester-side delete only.
        if (scope === 'all' && isAdminConversation && !req.user.is_admin) {
            await prisma.messages.update({
                where: { message_id: messageId },
                data: isSender
                    ? { deleted_for_sender: true }
                    : { deleted_for_receiver: true }
            });

            if (io) {
                io.to(`user_${userId}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: true
                });
            }
            await logSystemEvent(
                'USER_DELETE_ADMIN_PROTECTED',
                `User ${userId} requested delete-for-all for admin-involved message ${messageId}; applied requester-side delete`,
                {
                    userId,
                    messageId,
                    requestedScope: 'all',
                    appliedScope: isSender ? 'sender' : 'receiver',
                    senderId: message.sender_id,
                    receiverId: message.receiver_id
                }
            );
            return res.json({ success: true, adminProtected: true });
        }

        if (scope === 'all') {
            await prisma.messages.update({
                where: { message_id: messageId },
                data: {
                    deleted_for_sender: true,
                    deleted_for_receiver: true
                }
            });

            if (io) {
                io.to(`user_${message.sender_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: true
                });
                io.to(`user_${message.receiver_id}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: true
                });
            }
            await logSystemEvent(
                'USER_MESSAGE_DELETE',
                `User ${userId} deleted message ${messageId} for all`,
                { userId, messageId, scope: 'all', senderId: message.sender_id, receiverId: message.receiver_id }
            );
        } else {
            await prisma.messages.update({
                where: { message_id: messageId },
                data: isSender
                    ? { deleted_for_sender: true }
                    : { deleted_for_receiver: true }
            });

            if (io) {
                io.to(`user_${userId}`).emit('message_deleted', {
                    messageId,
                    deletedForEveryone: false
                });
            }
            await logSystemEvent(
                'USER_MESSAGE_DELETE',
                `User ${userId} deleted message ${messageId} for self`,
                {
                    userId,
                    messageId,
                    scope: isSender ? 'sender' : 'receiver',
                    senderId: message.sender_id,
                    receiverId: message.receiver_id
                }
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete message' });
    }
});

// ════════════════════════════════════════════════════════════
// USER: CLEAR ENTIRE CHAT (soft delete — my side only)
// ════════════════════════════════════════════════════════════
// Hides all messages in conversation from requester's view.
// Other user still sees every message unaffected.
router.delete('/conversation/:otherUserId/clear', isAuthenticated, async (req, res) => {
    try {
        const userId      = req.user.user_id;
        const otherUserId = parseInt(req.params.otherUserId);

        if (req.user.is_admin || await isAdminUser(otherUserId)) {
            await logSystemEvent(
                'USER_CLEAR_CHAT_REJECTED',
                `User ${userId} attempted clear chat for admin conversation with ${otherUserId}`,
                { userId, otherUserId }
            );
            return res.status(403).json({
                success: false,
                error: 'Clear chat is disabled for admin conversations'
            });
        }

        // Messages I sent → mark deleted_for_sender
        await prisma.messages.updateMany({
            where: { sender_id: userId, receiver_id: otherUserId },
            data:  { deleted_for_sender: true }
        });

        // Messages I received → mark deleted_for_receiver
        await prisma.messages.updateMany({
            where: { sender_id: otherUserId, receiver_id: userId },
            data:  { deleted_for_receiver: true }
        });

        // Notify only this user's UI to clear
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('chat_cleared', { otherUserId });
        }

        await logSystemEvent(
            'USER_CLEAR_CHAT',
            `User ${userId} cleared chat with ${otherUserId}`,
            { userId, otherUserId }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Clear chat error:', error);
        res.status(500).json({ success: false, error: 'Failed to clear chat' });
    }
});

module.exports = router;






