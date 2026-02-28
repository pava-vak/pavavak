// backend/routes/mobile.js
// Handles FCM device token registration from Android app

const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');

// Middleware — must be logged in
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ success: false, error: 'Not authenticated' });
}

// ── POST /api/mobile/register-token ─────────────────────────
// Called by Android app after login or when FCM token refreshes
// Body: { token, platform, deviceId }
router.post('/register-token', requireAuth, async (req, res) => {
    const { token, platform = 'android', deviceId = null } = req.body;
    const userId = req.user.user_id;

    if (!token || typeof token !== 'string' || token.length < 10) {
        return res.status(400).json({ success: false, error: 'Invalid token' });
    }

    try {
        // Upsert — if token exists update it, else create new
        await prisma.device_tokens.upsert({
            where: { token },
            update: {
                user_id:      userId,
                platform,
                device_id:    deviceId,
                is_active:    true,
                last_seen_at: new Date(),
                updated_at:   new Date()
            },
            create: {
                user_id:   userId,
                token,
                platform,
                device_id: deviceId,
                is_active: true
            }
        });

        console.log(`[FCM] Token registered for user ${userId}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[FCM] Register token error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to register token' });
    }
});

// ── POST /api/mobile/unregister-token ───────────────────────
// Called on logout — marks token inactive
// Body: { token }
router.post('/unregister-token', requireAuth, async (req, res) => {
    const { token } = req.body;
    const userId    = req.user.user_id;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Token required' });
    }

    try {
        await prisma.device_tokens.updateMany({
            where: { token, user_id: userId },
            data:  { is_active: false, updated_at: new Date() }
        });

        console.log(`[FCM] Token unregistered for user ${userId}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[FCM] Unregister token error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to unregister token' });
    }
});

module.exports = router;
