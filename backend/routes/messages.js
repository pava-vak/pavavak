const express = require('express');
const router  = express.Router();
const prisma = require('../lib/prisma'); // shared singleton — prevents connection pool exhaustion
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { sendToUser } = require('../lib/firebaseAdmin');

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

// ════════════════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════════════════
router.post('/send', isAuthenticated, async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.user_id;

        if (!receiverId || !content || !content.trim()) {
            return res.status(400).json({ success: false, error: 'receiverId and content required' });
        }

        const connection = await getConnection(senderId, parseInt(receiverId));
        if (!connection) {
            return res.status(403).json({ success: false, error: 'Not connected to this user' });
        }

        const message = await prisma.messages.create({
            data: {
                sender_id:   senderId,
                receiver_id: parseInt(receiverId),
                content:     content.trim(),
                is_read:     false
            }
        });

        const io          = req.app.get('io');
        const onlineUsers = req.app.get('onlineUsers');

        if (io) {
            io.to(`user_${receiverId}`).emit('new_message', {
                messageId:  message.message_id,
                senderId:   message.sender_id,
                receiverId: message.receiver_id,
                content:    message.content,
                sentAt:     message.sent_at,
                isRead:     message.is_read
            });

            if (onlineUsers && onlineUsers.has(parseInt(receiverId))) {
                io.to(`user_${senderId}`).emit('message_delivered', {
                    messageId: message.message_id
                });
            }
        }

        // Best-effort FCM push to receiver devices (non-blocking for chat send).
        sendToUser(prisma, parseInt(receiverId), {
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
                messageId:  message.message_id,
                senderId:   message.sender_id,
                receiverId: message.receiver_id,
                content:    message.content,
                sentAt:     message.sent_at,
                isRead:     message.is_read
            }
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// ════════════════════════════════════════════════════════════
// GET CONVERSATIONS LIST
// NOTE: must be defined BEFORE /:userId route in Express
// ════════════════════════════════════════════════════════════
router.get('/conversations/list', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.user_id;

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
                        isFromMe: lastMessage.sender_id === userId
                    } : null,
                    unreadCount
                };
            })
        );

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

        // Exclude messages soft-deleted for this user's side
        const messages = await prisma.messages.findMany({
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
        });

        const onlineUsers     = req.app.get('onlineUsers');
        const otherUserOnline = onlineUsers && onlineUsers.has(otherUserId);

        const formattedMessages = messages.map(msg => ({
            messageId:   msg.message_id,
            senderId:    msg.sender_id,
            receiverId:  msg.receiver_id,
            content:     msg.content,
            sentAt:      msg.sent_at,
            isRead:      msg.is_read,
            readAt:      msg.read_at,
            isDelivered: msg.is_read || otherUserOnline
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

        await prisma.messages.update({
            where: { message_id: messageId },
            data:  { is_read: true, read_at: new Date() }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${message.sender_id}`).emit('message_read', {
                messageId,
                readAt: new Date()
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, error: 'Failed to mark as read' });
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

        const message = await prisma.messages.findUnique({
            where: { message_id: messageId }
        });
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        await prisma.messages.delete({ where: { message_id: messageId } });

        // Notify both users — remove from both UIs
        const io = req.app.get('io');
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

        res.json({ success: true });
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

        // Soft delete — only hide for the requester
        await prisma.messages.update({
            where: { message_id: messageId },
            data:  isSender
                ? { deleted_for_sender:   true }
                : { deleted_for_receiver: true }
        });

        // Only notify the deleting user — other side unchanged
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('message_deleted', {
                messageId,
                deletedForEveryone: false
            });
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

        res.json({ success: true });
    } catch (error) {
        console.error('Clear chat error:', error);
        res.status(500).json({ success: false, error: 'Failed to clear chat' });
    }
});

module.exports = router;
