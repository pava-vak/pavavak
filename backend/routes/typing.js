const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { isAuthenticated } = require('../middleware/auth');

const TYPING_TTL_SECONDS = Number(process.env.TYPING_TTL_SECONDS || 12);

async function hasActiveConnection(userId1, userId2, isAdmin) {
  if (isAdmin) return true;
  const connection = await prisma.connections.findFirst({
    where: {
      OR: [
        { user1_id: userId1, user2_id: userId2, status: 'active' },
        { user1_id: userId2, user2_id: userId1, status: 'active' }
      ]
    },
    select: { connection_id: true }
  });
  return !!connection;
}

router.post('/start', isAuthenticated, async (req, res) => {
  try {
    const fromUserId = req.user.user_id;
    const toUserId = parseInt(req.body.toUserId, 10);
    if (!Number.isInteger(toUserId) || toUserId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid toUserId' });
    }
    if (toUserId === fromUserId) {
      return res.status(400).json({ success: false, error: 'Cannot type to self' });
    }

    const allowed = await hasActiveConnection(fromUserId, toUserId, !!req.user.is_admin);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Not connected to this user' });
    }

    await prisma.$executeRaw`
      INSERT INTO typing_status (from_user_id, to_user_id, is_typing, updated_at, expires_at)
      VALUES (${fromUserId}, ${toUserId}, true, NOW(), NOW() + (${TYPING_TTL_SECONDS} * INTERVAL '1 second'))
      ON CONFLICT (from_user_id, to_user_id)
      DO UPDATE SET
        is_typing = true,
        updated_at = NOW(),
        expires_at = NOW() + (${TYPING_TTL_SECONDS} * INTERVAL '1 second')
    `;

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${toUserId}`).emit('user_typing', { userId: fromUserId, isTyping: true });
    }

    res.json({ success: true, expiresInSeconds: TYPING_TTL_SECONDS });
  } catch (error) {
    console.error('Typing start error:', error);
    res.status(500).json({ success: false, error: 'Failed to set typing status' });
  }
});

router.post('/stop', isAuthenticated, async (req, res) => {
  try {
    const fromUserId = req.user.user_id;
    const toUserId = parseInt(req.body.toUserId, 10);
    if (!Number.isInteger(toUserId) || toUserId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid toUserId' });
    }

    await prisma.$executeRaw`
      UPDATE typing_status
      SET is_typing = false, updated_at = NOW(), expires_at = NOW()
      WHERE from_user_id = ${fromUserId} AND to_user_id = ${toUserId}
    `;

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${toUserId}`).emit('user_typing', { userId: fromUserId, isTyping: false });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Typing stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear typing status' });
  }
});

router.get('/:chatUserId', isAuthenticated, async (req, res) => {
  try {
    const myUserId = req.user.user_id;
    const chatUserId = parseInt(req.params.chatUserId, 10);
    if (!Number.isInteger(chatUserId) || chatUserId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid chatUserId' });
    }

    const allowed = await hasActiveConnection(myUserId, chatUserId, !!req.user.is_admin);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Not connected to this user' });
    }

    const rows = await prisma.$queryRaw`
      SELECT id, from_user_id, to_user_id, is_typing, expires_at, updated_at
      FROM typing_status
      WHERE from_user_id = ${chatUserId}
        AND to_user_id = ${myUserId}
      LIMIT 1
    `;
    const row = rows[0] || null;
    if (!row) {
      return res.json({
        success: true,
        typing: { fromUserId: chatUserId, toUserId: myUserId, isTyping: false, expiresAt: null }
      });
    }

    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    const isTyping = !!row.is_typing && expiresAtMs > Date.now();

    if (!isTyping && row.is_typing) {
      prisma.$executeRaw`
        UPDATE typing_status
        SET is_typing = false, updated_at = NOW()
        WHERE id = ${row.id}
      `.catch(() => {});
    }

    res.json({
      success: true,
      typing: {
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        isTyping,
        expiresAt: row.expires_at
      }
    });
  } catch (error) {
    console.error('Get typing status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch typing status' });
  }
});

module.exports = router;
