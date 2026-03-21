const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { sendToUser } = require('../lib/firebaseAdmin');

function generateTemporaryPassword() {
  return Math.random().toString(36).substring(2, 6).toUpperCase() +
         Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateOneTimePassword() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function writeSystemLog(action, details, metadata = null) {
  try {
    await prisma.system_logs.create({
      data: {
        level: 'INFO',
        action,
        message: details,
        details,
        event_type: action,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (error) {
    console.error('System log write failed:', error.message);
  }
}

// Dashboard stats
router.get('/dashboard/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [totalUsers, pendingUsers, activeConnections, totalMessages, pendingResets] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { is_approved: false } }),
      prisma.connections.count({ where: { status: 'active' } }),
      prisma.messages.count(),
      prisma.password_reset_requests.count({ where: { status: 'pending' } }).catch(() => 0)
    ]);
    res.json({ success: true, stats: { totalUsers, pendingUsers, activeConnections, totalMessages, pendingResets } });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Dashboard recent activity
router.get('/dashboard/activity', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [recentMessages, recentUsers] = await Promise.all([
      prisma.messages.findMany({
        include: {
          sender: { select: { username: true } },
          receiver: { select: { username: true } }
        },
        orderBy: { sent_at: 'desc' },
        take: 5
      }),
      prisma.users.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { username: true, created_at: true, is_approved: true }
      })
    ]);

    res.json({
      success: true,
      recentMessages: recentMessages.map(m => ({
        from: m.sender.username,
        to: m.receiver.username,
        sentAt: m.sent_at
      })),
      recentUsers: recentUsers.map(u => ({
        username: u.username,
        createdAt: u.created_at,
        isApproved: u.is_approved
      }))
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});
// Pending users
router.get('/users/pending', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pendingUsers = await prisma.users.findMany({
      where: { is_approved: false },
      select: { user_id: true, username: true, email: true, full_name: true, created_at: true },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, pendingUsers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Approve user
router.post('/users/:userId/approve', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.users.update({
      where: { user_id: parseInt(req.params.userId) },
      data: { is_approved: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Reject user
router.post('/users/:userId/reject', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.users.delete({ where: { user_id: parseInt(req.params.userId) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// All users
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { user_id: true, username: true, email: true, full_name: true, is_admin: true, is_approved: true, created_at: true, last_login: true },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Create user
router.post('/users/create', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { username, email, fullName, isAdmin: makeAdmin, isApproved } = req.body;

    if (!username) return res.status(400).json({ success: false, error: 'Username is required' });
    if (!fullName) return res.status(400).json({ success: false, error: 'Full name is required' });

    // Check existing
    const whereClause = email
      ? { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] }
      : { username: username.toLowerCase() };

    const existing = await prisma.users.findFirst({ where: whereClause });
    if (existing) return res.status(400).json({ success: false, error: 'Username or email already exists' });

    // Generate temp password
    const tempPassword = Math.random().toString(36).substring(2, 6).toUpperCase() +
                        Math.random().toString(36).substring(2, 6).toUpperCase();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.users.create({
      data: {
        username: username.toLowerCase(),
        email: email ? email.toLowerCase() : `${username.toLowerCase()}@noemail.local`,
        password_hash: passwordHash,
        full_name: fullName,
        is_approved: isApproved !== false,
        is_admin: makeAdmin || false
      }
    });

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        temporaryPassword: tempPassword
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// Edit user
router.put('/users/:userId/edit', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { fullName, email } = req.body;
    await prisma.users.update({
      where: { user_id: parseInt(req.params.userId) },
      data: {
        full_name: fullName,
        ...(email && { email: email.toLowerCase() })
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Delete user
router.delete('/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (userId === req.user.user_id) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    await prisma.users.delete({ where: { user_id: userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Toggle admin
router.put('/users/:userId/admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({ where: { user_id: parseInt(req.params.userId) } });
    await prisma.users.update({
      where: { user_id: parseInt(req.params.userId) },
      data: { is_admin: !user.is_admin }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Reset one user's password (admin action)
router.post('/users/:userId/reset-password', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, username: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.users.update({
      where: { user_id: userId },
      data: {
        password_hash: passwordHash,
        force_password_reset: true,
        reset_otp_hash: null,
        reset_otp_expiry: null,
        reset_otp_used_at: null,
        reset_token: null,
        reset_token_expiry: null
      }
    });

    res.json({
      success: true,
      reset: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        temporaryPassword
      }
    });
  } catch (error) {
    console.error('Reset single user password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Reset all users' passwords (admin action)
router.post('/users/reset-passwords-all', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const includeAdmins = req.body?.includeAdmins !== false;
    const includeCurrentAdmin = req.body?.includeCurrentAdmin !== false;

    const users = await prisma.users.findMany({
      select: { user_id: true, username: true, email: true, is_admin: true },
      orderBy: { user_id: 'asc' }
    });

    const targetUsers = users.filter(u => {
      if (!includeAdmins && u.is_admin) return false;
      if (!includeCurrentAdmin && u.user_id === req.user.user_id) return false;
      return true;
    });

    if (targetUsers.length === 0) {
      return res.status(400).json({ success: false, error: 'No users selected for reset' });
    }

    const resetCredentials = [];
    await prisma.$transaction(async (tx) => {
      for (const user of targetUsers) {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        await tx.users.update({
          where: { user_id: user.user_id },
          data: {
            password_hash: passwordHash,
            force_password_reset: true,
            reset_otp_hash: null,
            reset_otp_expiry: null,
            reset_otp_used_at: null,
            reset_token: null,
            reset_token_expiry: null
          }
        });

        resetCredentials.push({
          userId: user.user_id,
          username: user.username,
          email: user.email,
          isAdmin: user.is_admin,
          temporaryPassword
        });
      }
    });

    res.json({
      success: true,
      summary: {
        totalReset: resetCredentials.length,
        includeAdmins,
        includeCurrentAdmin
      },
      resetCredentials
    });
  } catch (error) {
    console.error('Bulk reset passwords error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset passwords' });
  }
});

// ==================== PASSWORD RESETS ====================

// Get pending reset requests
router.get('/password-resets/pending', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const requests = await prisma.password_reset_requests.findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { username: true, email: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      requests: requests.map(r => ({
        request_id: r.request_id,
        userId: r.user_id,
        username: r.user.username,
        email: r.user.email,
        status: r.status,
        created_at: r.created_at
      }))
    });
  } catch (error) {
    console.error('Get resets error:', error);
    res.json({ success: true, requests: [] });
  }
});

// Generate one-time password from reset request
router.post('/password-resets/:requestId/generate-otp', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ success: false, error: 'Invalid request id' });
    }

    const resetRequest = await prisma.password_reset_requests.findUnique({
      where: { request_id: requestId },
      include: {
        user: {
          select: {
            user_id: true,
            username: true
          }
        }
      }
    });
    if (!resetRequest) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const otp = generateOneTimePassword();
    const otpHash = await bcrypt.hash(otp, 12);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.users.update({
      where: { user_id: resetRequest.user.user_id },
      data: {
        reset_otp_hash: otpHash,
        reset_otp_expiry: expiresAt,
        reset_otp_used_at: null,
        force_password_reset: true,
        reset_token: null,
        reset_token_expiry: null
      }
    });

    await prisma.password_reset_requests.update({
      where: { request_id: requestId },
      data: {
        status: 'otp_generated',
        resolved_at: new Date()
      }
    });

    return res.json({
      success: true,
      otp,
      expiresAt,
      username: resetRequest.user.username
    });
  } catch (error) {
    console.error('Generate reset OTP error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate OTP' });
  }
});

// Generate reset link
router.post('/password-resets/:requestId/generate-link', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);

    const resetRequest = await prisma.password_reset_requests.findUnique({
      where: { request_id: requestId },
      include: { user: true }
    });

    if (!resetRequest) return res.status(404).json({ success: false, error: 'Request not found' });

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save token to user
    await prisma.users.update({
      where: { user_id: resetRequest.user_id },
      data: {
        reset_token: resetTokenHash,
        reset_token_expiry: expiry
      }
    });

    // Update request status
    await prisma.password_reset_requests.update({
      where: { request_id: requestId },
      data: { status: 'link_generated' }
    });

    const domain = process.env.DOMAIN || 'http://localhost:3000';
    const resetLink = `${domain}/reset-password.html?token=${resetToken}`;

    console.log('='.repeat(50));
    console.log('PASSWORD RESET LINK GENERATED:');
    console.log(`User: ${resetRequest.user.username}`);
    console.log(`Link: ${resetLink}`);
    console.log('='.repeat(50));

    res.json({ success: true, resetLink });
  } catch (error) {
    console.error('Generate reset link error:', error);
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// Dismiss reset request
router.post('/password-resets/:requestId/dismiss', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.password_reset_requests.update({
      where: { request_id: parseInt(req.params.requestId) },
      data: { status: 'dismissed' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// ==================== CONNECTIONS ====================

router.get('/connections', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const connections = await prisma.connections.findMany({
      include: {
        user1: { select: { user_id: true, username: true, full_name: true } },
        user2: { select: { user_id: true, username: true, full_name: true } }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({
      success: true,
      connections: connections.map(c => ({
        connectionId: c.connection_id,
        user1: c.user1,
        user2: c.user2,
        status: c.status,
        createdAt: c.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

router.post('/connections/create', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body;
    if (user1Id === user2Id) return res.status(400).json({ success: false, error: 'Cannot connect to self' });

    const existing = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: user1Id, user2_id: user2Id },
          { user1_id: user2Id, user2_id: user1Id }
        ]
      }
    });
    if (existing) return res.status(400).json({ success: false, error: 'Connection already exists' });

    await prisma.connections.create({ data: { user1_id: user1Id, user2_id: user2Id, status: 'active' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

router.delete('/connections/:connectionId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.connections.delete({ where: { connection_id: parseInt(req.params.connectionId) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// ==================== MESSAGES ====================

router.get('/messages/recent', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await prisma.messages.findMany({
      include: {
        sender: { select: { user_id: true, username: true } },
        receiver: { select: { user_id: true, username: true } }
      },
      orderBy: { sent_at: 'desc' },
      take: limit
    });
    res.json({
      success: true,
      messages: messages.map(m => ({
        messageId: m.message_id,
        sender: m.sender,
        receiver: m.receiver,
        content: m.content,
        sentAt: m.sent_at,
        isRead: m.is_read
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

router.delete('/messages/:messageId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.messages.delete({ where: { message_id: parseInt(req.params.messageId) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// ==================== INVITES ====================

router.get('/invites', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const invites = await prisma.invite_codes.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json({
      success: true,
      invites: invites.map(i => ({
        code: i.code,
        used: i.used,
        usedBy: null,
        createdAt: i.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

router.post('/invites/generate', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const code = `PV-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await prisma.invite_codes.create({
      data: {
        code,
        used: false,
        created_by_user_id: req.user.user_id
      }
    });
    res.json({ success: true, codes: [code] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

router.delete('/invites/:code', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await prisma.invite_codes.delete({ where: { code: req.params.code } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// ==================== BROADCAST NOTIFICATIONS ====================

router.get('/notifications/recipients', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      where: { is_approved: true },
      select: {
        user_id: true,
        username: true,
        full_name: true,
        is_admin: true
      },
      orderBy: [
        { is_admin: 'desc' },
        { username: 'asc' }
      ]
    });

    const tokenGroups = await prisma.device_tokens.groupBy({
      by: ['user_id'],
      where: { is_active: true },
      _count: { _all: true }
    });

    const activeTokenCount = new Map(tokenGroups.map(row => [row.user_id, row._count._all]));
    const recipients = users.map(user => ({
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      isAdmin: user.is_admin,
      activeTokenCount: activeTokenCount.get(user.user_id) || 0
    }));

    res.json({
      success: true,
      recipients,
      summary: {
        totalUsers: recipients.length,
        activeTokenUsers: recipients.filter(r => r.activeTokenCount > 0).length
      }
    });
  } catch (error) {
    console.error('Broadcast recipients error:', error);
    res.status(500).json({ success: false, error: 'Failed to load broadcast recipients' });
  }
});

router.post('/notifications/broadcast', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const mode = req.body?.mode === 'selected' ? 'selected' : 'all';
    const includeSelf = req.body?.includeSelf === true;
    const selectedIdsRaw = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const selectedIds = selectedIdsRaw
      .map((value) => parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!title) {
      return res.status(400).json({ success: false, error: 'Notification title is required' });
    }
    if (!body) {
      return res.status(400).json({ success: false, error: 'Notification message is required' });
    }
    if (title.length > 80) {
      return res.status(400).json({ success: false, error: 'Notification title is too long' });
    }
    if (body.length > 240) {
      return res.status(400).json({ success: false, error: 'Notification message is too long' });
    }
    if (mode === 'selected' && selectedIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one user' });
    }

    const where = {
      is_approved: true,
      ...(mode === 'selected' ? { user_id: { in: selectedIds } } : {})
    };
    if (!includeSelf) {
      where.user_id = where.user_id
        ? { ...where.user_id, not: req.user.user_id }
        : { not: req.user.user_id };
    }

    const targetUsers = await prisma.users.findMany({
      where,
      select: {
        user_id: true,
        username: true,
        full_name: true,
        is_admin: true
      },
      orderBy: { username: 'asc' }
    });

    if (targetUsers.length === 0) {
      return res.status(400).json({ success: false, error: 'No users matched this broadcast' });
    }

    const broadcastId = `broadcast-${Date.now()}`;
    const sendResults = await Promise.allSettled(
      targetUsers.map(async (user) => ({
        user,
        delivery: await sendToUser(prisma, user.user_id, {
          type: 'broadcast',
          messageId: broadcastId,
          senderId: req.user.user_id,
          chatUserId: 0,
          senderName: title,
          previewText: body,
          sentAt: new Date().toISOString()
        })
      }))
    );

    const resolvedResults = sendResults.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        user: targetUsers[index],
        delivery: {
          tokenCount: 0,
          okCount: 0,
          invalidCount: 0,
          errorCount: 1,
          skippedNoToken: false,
          dbError: true
        }
      };
    });

    const usersWithActiveTokens = resolvedResults.filter((entry) => entry.delivery.tokenCount > 0).length;
    const sentUsers = resolvedResults.filter((entry) => entry.delivery.okCount > 0).length;
    const sentNotifications = resolvedResults.reduce((sum, entry) => sum + entry.delivery.okCount, 0);
    const skippedUsers = resolvedResults
      .filter((entry) => entry.delivery.skippedNoToken)
      .map((entry) => ({
        userId: entry.user.user_id,
        username: entry.user.username
      }));
    const failedUsers = resolvedResults
      .filter((entry) => entry.delivery.errorCount > 0 && entry.delivery.okCount == 0)
      .map((entry) => ({
        userId: entry.user.user_id,
        username: entry.user.username
      }));

    await writeSystemLog(
      'ADMIN_BROADCAST_SENT',
      `Broadcast "${title}" sent by admin ${req.user.username || req.user.user_id}`,
      {
        adminId: req.user.user_id,
        title,
        mode,
        includeSelf,
        targetedCount: targetUsers.length,
        usersWithActiveTokens,
        sentUsers,
        sentNotifications,
        skippedNoTokenCount: skippedUsers.length,
        failedCount: failedUsers.length,
        targetUserIds: targetUsers.map((user) => user.user_id)
      }
    );

    res.json({
      success: true,
      summary: {
        title,
        mode,
        includeSelf,
        targetedCount: targetUsers.length,
        usersWithActiveTokens,
        sentUsers,
        sentNotifications,
        skippedNoTokenCount: skippedUsers.length,
        failedCount: failedUsers.length
      },
      failedUsers,
      skippedUsers
    });
  } catch (error) {
    console.error('Broadcast send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send broadcast notification' });
  }
});

// ==================== LOGS ====================

router.get('/logs', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { level } = req.query;
    const where = level ? { level } : {};

    const logs = await prisma.system_logs.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.json({ success: true, logs: [] });
  }
});

module.exports = router;
