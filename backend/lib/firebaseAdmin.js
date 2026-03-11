// backend/lib/firebaseAdmin.js
// Firebase Admin SDK - singleton, lazy-initialized with Cloud Run friendly fallbacks.

const admin = require('firebase-admin');
const fs = require('fs');

let initialized = false;

function getFirebaseAdmin() {
    if (initialized) return admin;

    const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
        if (keyJson) {
            const serviceAccount = JSON.parse(keyJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            initialized = true;
            console.log('[FCM] Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_JSON');
            return admin;
        }

        if (keyPath) {
            if (!fs.existsSync(keyPath)) {
                throw new Error(`Service account file not found at: ${keyPath}`);
            }
            const serviceAccount = require(keyPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            initialized = true;
            console.log(`[FCM] Firebase Admin initialized via key file (${keyPath})`);
            return admin;
        }

        // Cloud Run / GCE default credentials fallback.
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        initialized = true;
        console.log('[FCM] Firebase Admin initialized via application default credentials');
        return admin;
    } catch (e) {
        throw new Error(`[FCM] Firebase Admin init failed: ${e.message}`);
    }
}

// Send FCM notification to a single token
// Returns: 'ok' | 'invalid' | 'error'
async function sendPushNotification(token, data = {}) {
    try {
        const fb = getFirebaseAdmin();
        const message = {
            token,
            data: {
                type: data.type || 'new_message',
                messageId: String(data.messageId || ''),
                senderId: String(data.senderId || ''),
                chatUserId: String(data.chatUserId || ''),
                unreadCount: String(data.unreadCount || 1),
                senderName: String(data.senderName || ''),
                previewText: String(data.previewText || ''),
                sentAt: String(data.sentAt || '')
            },
            android: {
                priority: 'high',
                ttl: 5 * 60 * 1000,
                collapseKey: data.chatUserId ? `chat_${data.chatUserId}` : 'chat_updates',
                directBootOk: true
            }
        };

        await fb.messaging().send(message);
        console.log(`[FCM] Sent type=${message.data.type} chatUserId=${message.data.chatUserId} messageId=${message.data.messageId}`);
        return 'ok';

    } catch (err) {
        if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token'
        ) {
            return 'invalid';
        }
        console.error('[FCM] Send error:', err.message);
        return 'error';
    }
}

// Send to all active tokens for a user
// Automatically marks invalid tokens as inactive
async function sendToUser(prisma, userId, data = {}) {
    let tokens = [];
    try {
        tokens = await prisma.device_tokens.findMany({
            where: { user_id: userId, is_active: true }
        });
    } catch (err) {
        console.error('[FCM] DB error fetching tokens:', err.message);
        return;
    }

    if (tokens.length === 0) {
        console.warn(`[FCM] No active tokens for user ${userId}`);
        return;
    }
    console.log(`[FCM] Preparing push for user ${userId} tokens=${tokens.length} type=${data.type || 'new_message'} chatUserId=${data.chatUserId || ''} messageId=${data.messageId || ''}`);

    let unreadCount = Number(data.unreadCount || 0);
    if (!Number.isFinite(unreadCount) || unreadCount <= 0) {
        try {
            unreadCount = await prisma.messages.count({
                where: {
                    receiver_id: userId,
                    is_read: false,
                    deleted_for_receiver: false
                }
            });
        } catch (err) {
            console.error('[FCM] Failed to compute unread count:', err.message);
            unreadCount = 1;
        }
    }

    const results = await Promise.allSettled(
        tokens.map(t => sendPushNotification(t.token, { ...data, unreadCount }))
    );

    const invalidTokens = tokens.filter((t, i) => {
        const r = results[i];
        return r.status === 'fulfilled' && r.value === 'invalid';
    });

    if (invalidTokens.length > 0) {
        await prisma.device_tokens.updateMany({
            where: { id: { in: invalidTokens.map(t => t.id) } },
            data: { is_active: false }
        }).catch(e => console.error('[FCM] Error deactivating tokens:', e.message));

        console.log(`[FCM] Deactivated ${invalidTokens.length} invalid token(s) for user ${userId}`);
    }

    const okCount = results.filter(r => r.status === 'fulfilled' && r.value === 'ok').length;
    const errCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === 'error')).length;
    if (okCount > 0) {
        console.log(`[FCM] Sent ${okCount}/${tokens.length} notification(s) to user ${userId}`);
    }
    if (errCount > 0) {
        console.warn(`[FCM] Failed ${errCount}/${tokens.length} notification(s) for user ${userId}`);
    }
}

module.exports = { getFirebaseAdmin, sendPushNotification, sendToUser };
