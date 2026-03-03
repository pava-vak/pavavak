// backend/lib/firebaseAdmin.js
// Firebase Admin SDK — singleton, lazy-initialized

const admin = require('firebase-admin');
const fs    = require('fs');

let initialized = false;

function getFirebaseAdmin() {
    if (initialized) return admin;

    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!keyPath) {
        throw new Error('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH not set in .env');
    }
    if (!fs.existsSync(keyPath)) {
        throw new Error(`[FCM] Service account file not found at: ${keyPath}`);
    }

    const serviceAccount = require(keyPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    initialized = true;
    console.log('[FCM] Firebase Admin initialized ✅');
    return admin;
}

// Send FCM notification to a single token
// Returns: 'ok' | 'invalid' | 'error'
async function sendPushNotification(token, data = {}) {
    try {
        const fb = getFirebaseAdmin();

        const message = {
            token,
            // Hidden payload — no message content for privacy
            data: {
                type:       data.type       || 'new_message',
                messageId:  String(data.messageId  || ''),
                senderId:   String(data.senderId   || ''),
                chatUserId: String(data.chatUserId || '')
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'messages_secure',
                    title:     'PaVa-Vak',
                    body:      'You have a new message'
                }
            }
        };

        await fb.messaging().send(message);
        return 'ok';

    } catch (err) {
        // Token no longer valid — mark as inactive in DB
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

    if (tokens.length === 0) return;

    const results = await Promise.allSettled(
        tokens.map(t => sendPushNotification(t.token, data))
    );

    // Deactivate invalid tokens
    const invalidTokens = tokens.filter((t, i) => {
        const r = results[i];
        return r.status === 'fulfilled' && r.value === 'invalid';
    });

    if (invalidTokens.length > 0) {
        await prisma.device_tokens.updateMany({
            where: { id: { in: invalidTokens.map(t => t.id) } },
            data:  { is_active: false }
        }).catch(e => console.error('[FCM] Error deactivating tokens:', e.message));

        console.log(`[FCM] Deactivated ${invalidTokens.length} invalid token(s) for user ${userId}`);
    }

    const okCount = results.filter(r => r.status === 'fulfilled' && r.value === 'ok').length;
    if (okCount > 0) {
        console.log(`[FCM] Sent ${okCount}/${tokens.length} notification(s) to user ${userId}`);
    }
}

module.exports = { getFirebaseAdmin, sendPushNotification, sendToUser };
