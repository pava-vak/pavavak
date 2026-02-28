// Admin Controller
const logger = require('../utils/logger');
const crypto = require('crypto');

const prisma = require('../lib/prisma');

// Helper function to log admin actions
async function logAdminAction(adminId, action, details) {
  try {
    await prisma.admin_logs.create({
      data: {
        admin_id: adminId,
        action: action,
        details: details,
        performed_at: new Date()
      }
    });
    logger.info(`Admin action: ${action} by admin ${adminId}`);
  } catch (error) {
    logger.error('Failed to log admin action:', error);
  }
}

// GET /api/admin/dashboard/stats - Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    // Get counts
    const totalUsers = await prisma.users.count();
    const pendingUsers = await prisma.users.count({
      where: { is_approved: false }
    });
    const activeConnections = await prisma.connections.count({
      where: { status: 'active' }
    });
    const totalMessages = await prisma.messages.count();
    
    // Get messages from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesLast24h = await prisma.messages.count({
      where: {
        sent_at: { gte: oneDayAgo }
      }
    });

    // Get active invite codes
    const activeInvites = await prisma.invite_codes.count({
      where: { used: false }
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        pendingUsers,
        activeConnections,
        totalMessages,
        messagesLast24h,
        activeInvites
      }
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard statistics'
    });
  }
};

// GET /api/admin/dashboard/activity - Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get recent registrations
    const recentUsers = await prisma.users.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        user_id: true,
        username: true,
        created_at: true,
        is_approved: true
      }
    });

    // Get recent messages
    const recentMessages = await prisma.messages.findMany({
      take: 10,
      orderBy: { sent_at: 'desc' },
      include: {
        users_messages_sender_idTousers: {
          select: { username: true }
        },
        users_messages_receiver_idTousers: {
          select: { username: true }
        }
      }
    });

    // Get recent admin actions
    const recentAdminActions = await prisma.admin_logs.findMany({
      take: 10,
      orderBy: { performed_at: 'desc' },
      include: {
        users: {
          select: { username: true }
        }
      }
    });

    res.json({
      success: true,
      activity: {
        recentUsers: recentUsers.map(u => ({
          userId: u.user_id,
          username: u.username,
          createdAt: u.created_at,
          isApproved: u.is_approved
        })),
        recentMessages: recentMessages.map(m => ({
          messageId: m.message_id,
          from: m.users_messages_sender_idTousers.username,
          to: m.users_messages_receiver_idTousers.username,
          sentAt: m.sent_at
        })),
        recentAdminActions: recentAdminActions.map(a => ({
          action: a.action,
          admin: a.users.username,
          details: a.details,
          performedAt: a.performed_at
        }))
      }
    });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load recent activity'
    });
  }
};

// GET /api/admin/users - Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        is_admin: true,
        is_approved: true,
        two_factor_enabled: true,
        created_at: true,
        last_login: true
      }
    });

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load users'
    });
  }
};

// GET /api/admin/users/pending - Get pending user approvals
exports.getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await prisma.users.findMany({
      where: { is_approved: false },
      orderBy: { created_at: 'desc' },
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        created_at: true
      }
    });

    res.json({
      success: true,
      pendingUsers: pendingUsers
    });
  } catch (error) {
    logger.error('Get pending users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load pending users'
    });
  }
};

// POST /api/admin/users/:userId/approve - Approve a user
exports.approveUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminId = req.user.user_id;

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.is_approved) {
      return res.status(400).json({
        success: false,
        error: 'User already approved'
      });
    }

    // Approve user
    await prisma.users.update({
      where: { user_id: userId },
      data: { is_approved: true }
    });

    // Log admin action
    await logAdminAction(adminId, 'USER_APPROVED', `Approved user: ${user.username} (ID: ${userId})`);

    logger.info(`User ${user.username} approved by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'User approved successfully'
    });
  } catch (error) {
    logger.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve user'
    });
  }
};

// POST /api/admin/users/:userId/reject - Reject a user
exports.rejectUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminId = req.user.user_id;

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete user (and all related data via cascade)
    await prisma.users.delete({
      where: { user_id: userId }
    });

    // Log admin action
    await logAdminAction(adminId, 'USER_REJECTED', `Rejected user: ${user.username} (ID: ${userId})`);

    logger.info(`User ${user.username} rejected and deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'User rejected and deleted'
    });
  } catch (error) {
    logger.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject user'
    });
  }
};

// DELETE /api/admin/users/:userId - Delete a user
exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminId = req.user.user_id;

    if (userId === adminId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete user
    await prisma.users.delete({
      where: { user_id: userId }
    });

    // Log admin action
    await logAdminAction(adminId, 'USER_DELETED', `Deleted user: ${user.username} (ID: ${userId})`);

    logger.info(`User ${user.username} deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};

// PUT /api/admin/users/:userId/admin - Toggle admin status
exports.toggleAdminStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminId = req.user.user_id;

    if (userId === adminId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own admin status'
      });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Toggle admin status
    const updatedUser = await prisma.users.update({
      where: { user_id: userId },
      data: { is_admin: !user.is_admin }
    });

    // Log admin action
    const action = updatedUser.is_admin ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED';
    await logAdminAction(adminId, action, `${action} for user: ${user.username} (ID: ${userId})`);

    logger.info(`Admin status toggled for ${user.username} by admin ${req.user.username}`);

    res.json({
      success: true,
      isAdmin: updatedUser.is_admin,
      message: `User ${updatedUser.is_admin ? 'granted' : 'revoked'} admin privileges`
    });
  } catch (error) {
    logger.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin status'
    });
  }
};

// GET /api/admin/connections - Get all connections
exports.getAllConnections = async (req, res) => {
  try {
    const connections = await prisma.connections.findMany({
      include: {
        users_connections_user1_idTousers: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        },
        users_connections_user2_idTousers: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      connections: connections.map(conn => ({
        connectionId: conn.connection_id,
        user1: conn.users_connections_user1_idTousers,
        user2: conn.users_connections_user2_idTousers,
        status: conn.status,
        createdAt: conn.created_at
      }))
    });
  } catch (error) {
    logger.error('Get all connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load connections'
    });
  }
};

// POST /api/admin/connections/create - Create a connection
exports.createConnection = async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body;
    const adminId = req.user.user_id;

    // Validate users exist
    const user1 = await prisma.users.findUnique({ where: { user_id: user1Id } });
    const user2 = await prisma.users.findUnique({ where: { user_id: user2Id } });

    if (!user1 || !user2) {
      return res.status(404).json({
        success: false,
        error: 'One or both users not found'
      });
    }

    // Check if connection already exists
    const existing = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: user1Id, user2_id: user2Id },
          { user1_id: user2Id, user2_id: user1Id }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Connection already exists'
      });
    }

    // Create connection
    const connection = await prisma.connections.create({
      data: {
        user1_id: Math.min(user1Id, user2Id),
        user2_id: Math.max(user1Id, user2Id),
        status: 'active',
        created_at: new Date()
      }
    });

    // Log admin action
    await logAdminAction(adminId, 'CONNECTION_CREATED', `Created connection between ${user1.username} and ${user2.username}`);

    logger.info(`Connection created between ${user1.username} and ${user2.username} by admin ${req.user.username}`);

    res.json({
      success: true,
      connection: {
        connectionId: connection.connection_id,
        user1: { userId: user1.user_id, username: user1.username },
        user2: { userId: user2.user_id, username: user2.username },
        createdAt: connection.created_at
      }
    });
  } catch (error) {
    logger.error('Create connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create connection'
    });
  }
};

// DELETE /api/admin/connections/:connectionId - Delete a connection
exports.deleteConnection = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const adminId = req.user.user_id;

    const connection = await prisma.connections.findUnique({
      where: { connection_id: connectionId },
      include: {
        users_connections_user1_idTousers: { select: { username: true } },
        users_connections_user2_idTousers: { select: { username: true } }
      }
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    // Delete connection
    await prisma.connections.delete({
      where: { connection_id: connectionId }
    });

    // Log admin action
    await logAdminAction(
      adminId,
      'CONNECTION_DELETED',
      `Deleted connection between ${connection.users_connections_user1_idTousers.username} and ${connection.users_connections_user2_idTousers.username}`
    );

    logger.info(`Connection ${connectionId} deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });
  } catch (error) {
    logger.error('Delete connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete connection'
    });
  }
};

// GET /api/admin/messages/recent - Get recent messages
exports.getRecentMessages = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const messages = await prisma.messages.findMany({
      take: limit,
      orderBy: { sent_at: 'desc' },
      include: {
        users_messages_sender_idTousers: {
          select: { user_id: true, username: true, full_name: true }
        },
        users_messages_receiver_idTousers: {
          select: { user_id: true, username: true, full_name: true }
        }
      }
    });

    res.json({
      success: true,
      messages: messages.map(m => ({
        messageId: m.message_id,
        sender: m.users_messages_sender_idTousers,
        receiver: m.users_messages_receiver_idTousers,
        content: m.content,
        sentAt: m.sent_at,
        isRead: m.is_read
      }))
    });
  } catch (error) {
    logger.error('Get recent messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load messages'
    });
  }
};

// DELETE /api/admin/messages/:messageId - Delete a message (admin)
exports.deleteMessage = async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const adminId = req.user.user_id;

    const message = await prisma.messages.findUnique({
      where: { message_id: messageId },
      include: {
        users_messages_sender_idTousers: { select: { username: true } },
        users_messages_receiver_idTousers: { select: { username: true } }
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Delete message timer first
    await prisma.message_timers.deleteMany({
      where: { message_id: messageId }
    });

    // Delete message
    await prisma.messages.delete({
      where: { message_id: messageId }
    });

    // Log admin action
    await logAdminAction(
      adminId,
      'MESSAGE_DELETED',
      `Deleted message ${messageId} from ${message.users_messages_sender_idTousers.username} to ${message.users_messages_receiver_idTousers.username}`
    );

    logger.info(`Message ${messageId} deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Admin delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
};

// GET /api/admin/messages/user/:userId - Get messages for a specific user
exports.getUserMessages = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 100;

    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: userId },
          { receiver_id: userId }
        ]
      },
      take: limit,
      orderBy: { sent_at: 'desc' },
      include: {
        users_messages_sender_idTousers: {
          select: { username: true }
        },
        users_messages_receiver_idTousers: {
          select: { username: true }
        }
      }
    });

    res.json({
      success: true,
      messages: messages.map(m => ({
        messageId: m.message_id,
        from: m.users_messages_sender_idTousers.username,
        to: m.users_messages_receiver_idTousers.username,
        content: m.content,
        sentAt: m.sent_at,
        isRead: m.is_read
      }))
    });
  } catch (error) {
    logger.error('Get user messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user messages'
    });
  }
};

// GET /api/admin/invites - Get all invite codes
exports.getAllInvites = async (req, res) => {
  try {
    const invites = await prisma.invite_codes.findMany({
      include: {
        users: {
          select: {
            username: true,
            full_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      invites: invites.map(inv => ({
        code: inv.code,
        used: inv.used,
        usedBy: inv.users ? inv.users.username : null,
        createdAt: inv.created_at
      }))
    });
  } catch (error) {
    logger.error('Get all invites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load invites'
    });
  }
};

// POST /api/admin/invites/generate - Generate new invite code
exports.generateInvite = async (req, res) => {
  try {
    const adminId = req.user.user_id;
    const { count = 1 } = req.body;

    const codes = [];

    for (let i = 0; i < Math.min(count, 10); i++) {
      // Generate code: PV-XXXX-YYYY format
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const code = `PV-${part1}-${part2}`;

      const invite = await prisma.invite_codes.create({
        data: {
          code: code,
          used: false,
          created_at: new Date()
        }
      });

      codes.push(invite.code);
    }

    // Log admin action
    await logAdminAction(adminId, 'INVITES_GENERATED', `Generated ${codes.length} invite code(s)`);

    logger.info(`${codes.length} invite code(s) generated by admin ${req.user.username}`);

    res.json({
      success: true,
      codes: codes,
      message: `Generated ${codes.length} invite code(s)`
    });
  } catch (error) {
    logger.error('Generate invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invite code'
    });
  }
};

// DELETE /api/admin/invites/:code - Delete an invite code
exports.deleteInvite = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const adminId = req.user.user_id;

    const invite = await prisma.invite_codes.findUnique({
      where: { code: code }
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Invite code not found'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete used invite code'
      });
    }

    await prisma.invite_codes.delete({
      where: { code: code }
    });

    // Log admin action
    await logAdminAction(adminId, 'INVITE_DELETED', `Deleted invite code: ${code}`);

    logger.info(`Invite code ${code} deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Invite code deleted successfully'
    });
  } catch (error) {
    logger.error('Delete invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete invite code'
    });
  }
};

// GET /api/admin/logs/admin - Get admin action logs
exports.getAdminLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const logs = await prisma.admin_logs.findMany({
      take: limit,
      orderBy: { performed_at: 'desc' },
      include: {
        users: {
          select: { username: true, full_name: true }
        }
      }
    });

    res.json({
      success: true,
      logs: logs.map(log => ({
        action: log.action,
        admin: log.users.username,
        details: log.details,
        performedAt: log.performed_at
      }))
    });
  } catch (error) {
    logger.error('Get admin logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load admin logs'
    });
  }
};

// GET /api/admin/logs/system - Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const logs = await prisma.system_logs.findMany({
      take: limit,
      orderBy: { logged_at: 'desc' }
    });

    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    logger.error('Get system logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load system logs'
    });
  }
};

// GET /api/admin/logs/login - Get login attempt logs
exports.getLoginLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const logs = await prisma.login_attempts.findMany({
      take: limit,
      orderBy: { attempted_at: 'desc' },
      include: {
        users: {
          select: { username: true }
        }
      }
    });

    res.json({
      success: true,
      logs: logs.map(log => ({
        username: log.users.username,
        success: log.success,
        ipAddress: log.ip_address,
        attemptedAt: log.attempted_at
      }))
    });
  } catch (error) {
    logger.error('Get login logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load login logs'
    });
  }
};

// GET /api/admin/analytics/users - Get user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    // Users created per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const usersByDay = await prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      analytics: {
        usersByDay: usersByDay
      }
    });
  } catch (error) {
    logger.error('Get user analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user analytics'
    });
  }
};

// GET /api/admin/analytics/messages - Get message analytics
exports.getMessageAnalytics = async (req, res) => {
  try {
    // Messages per day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const messagesByDay = await prisma.$queryRaw`
      SELECT DATE(sent_at) as date, COUNT(*) as count
      FROM messages
      WHERE sent_at >= ${thirtyDaysAgo}
      GROUP BY DATE(sent_at)
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      analytics: {
        messagesByDay: messagesByDay
      }
    });
  } catch (error) {
    logger.error('Get message analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load message analytics'
    });
  }
};

// POST /api/admin/backup/create - Create database backup
exports.createBackup = async (req, res) => {
  try {
    const adminId = req.user.user_id;

    // This would typically call a backup script
    // For now, just log the action
    await logAdminAction(adminId, 'BACKUP_CREATED', 'Manual backup initiated');

    logger.info(`Backup initiated by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Backup initiated. Check server logs for progress.'
    });
  } catch (error) {
    logger.error('Create backup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
};

// GET /api/admin/backup/list - List available backups
exports.listBackups = async (req, res) => {
  try {
    // This would typically list backup files from storage
    // For now, return empty list
    res.json({
      success: true,
      backups: []
    });
  } catch (error) {
    logger.error('List backups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups'
    });
  }
};

// GET /api/admin/backup/download/:filename - Download a backup
exports.downloadBackup = async (req, res) => {
  try {
    const filename = req.params.filename;

    // This would typically serve the backup file
    // For now, just return error
    res.status(501).json({
      success: false,
      error: 'Backup download not implemented yet'
    });
  } catch (error) {
    logger.error('Download backup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup'
    });
  }
};

module.exports = exports;
