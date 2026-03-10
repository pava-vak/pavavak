const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { isAuthenticated } = require('../middleware/auth');

const ONLINE_WINDOW_SECONDS = Number(process.env.PRESENCE_ONLINE_WINDOW_SECONDS || 70);

async function canViewPresence(viewerId, targetId, isAdmin) {
  if (isAdmin || viewerId === targetId) return true;
  const connection = await prisma.connections.findFirst({
    where: {
      OR: [
        { user1_id: viewerId, user2_id: targetId, status: 'active' },
        { user1_id: targetId, user2_id: viewerId, status: 'active' }
      ]
    },
    select: { connection_id: true }
  });
  return !!connection;
}

router.post('/heartbeat', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    await prisma.$executeRaw`
      INSERT INTO user_presence (user_id, is_online, last_heartbeat_at, updated_at)
      VALUES (${userId}, true, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_online = true,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('Presence heartbeat error:', error);
    res.status(500).json({ success: false, error: 'Failed to update presence heartbeat' });
  }
});

router.post('/offline', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    await prisma.$executeRaw`
      INSERT INTO user_presence (user_id, is_online, last_seen_at, last_heartbeat_at, updated_at)
      VALUES (${userId}, false, NOW(), NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_online = false,
        last_seen_at = NOW(),
        updated_at = NOW()
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('Presence offline error:', error);
    res.status(500).json({ success: false, error: 'Failed to set offline status' });
  }
});

router.get('/me', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const rows = await prisma.$queryRaw`
      SELECT up.user_id, up.is_online, up.last_seen_at, up.last_heartbeat_at, up.updated_at, u.hide_last_seen
      FROM user_presence up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0] || null;
    if (!row) {
      return res.json({
        success: true,
        presence: {
          userId,
          isOnline: false,
          lastSeenAt: null,
          lastHeartbeatAt: null,
          isLastSeenHidden: !!req.user.hide_last_seen
        }
      });
    }

    const heartbeatAt = row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : 0;
    const isFresh = heartbeatAt > 0 && (Date.now() - heartbeatAt) <= ONLINE_WINDOW_SECONDS * 1000;
    const isOnline = !!row.is_online && isFresh;

    res.json({
      success: true,
      presence: {
        userId: row.user_id,
        isOnline,
        lastSeenAt: row.last_seen_at,
        lastHeartbeatAt: row.last_heartbeat_at,
        isLastSeenHidden: !!row.hide_last_seen
      }
    });
  } catch (error) {
    console.error('Get self presence error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch self presence' });
  }
});

router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const viewerId = req.user.user_id;
    const targetId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid userId' });
    }

    const allowed = await canViewPresence(viewerId, targetId, !!req.user.is_admin);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Not allowed to view presence' });
    }

    const rows = await prisma.$queryRaw`
      SELECT up.user_id, up.is_online, up.last_seen_at, up.last_heartbeat_at, up.updated_at, u.hide_last_seen
      FROM user_presence up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.user_id = ${targetId}
      LIMIT 1
    `;
    const row = rows[0] || null;
    const lastSeenHidden = !!row?.hide_last_seen && !req.user.is_admin && viewerId !== targetId;
    if (!row) {
      return res.json({
        success: true,
        presence: {
          userId: targetId,
          isOnline: false,
          lastSeenAt: null,
          lastHeartbeatAt: null,
          isLastSeenHidden: false
        }
      });
    }

    const heartbeatAt = row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : 0;
    const isFresh = heartbeatAt > 0 && (Date.now() - heartbeatAt) <= ONLINE_WINDOW_SECONDS * 1000;
    const isOnline = !!row.is_online && isFresh;

    if (!isOnline && row.is_online) {
      prisma.$executeRaw`
        UPDATE user_presence
        SET is_online = false, last_seen_at = NOW(), updated_at = NOW()
        WHERE user_id = ${targetId}
      `.catch(() => {});
    }

    res.json({
      success: true,
      presence: {
        userId: row.user_id,
        isOnline,
        lastSeenAt: lastSeenHidden ? null : row.last_seen_at,
        lastHeartbeatAt: row.last_heartbeat_at,
        isLastSeenHidden: lastSeenHidden
      }
    });
  } catch (error) {
    console.error('Get user presence error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user presence' });
  }
});

module.exports = router;
