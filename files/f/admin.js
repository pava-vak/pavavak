const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// Middleware to check admin role
const isAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Error checking admin role:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Get all users (admin only)
router.get('/users', authenticate, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          twoFactorEnabled: true,
          createdAt: true,
          lastLogin: true,
          _count: {
            select: {
              sentConnections: true,
              receivedConnections: true,
              sentMessages: true,
              receivedMessages: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details (admin only)
router.get('/users/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sentConnections: {
          include: {
            friend: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        },
        receivedConnections: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        },
        inviteCodes: {
          include: {
            usedByUser: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    logger.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user role (admin only)
router.put('/users/:userId/role', authenticate, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true
      }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.user.userId,
        action: 'UPDATE_USER_ROLE',
        targetId: userId,
        details: `Changed role to ${role}`
      }
    });

    logger.info(`Admin ${req.user.userId} changed user ${userId} role to ${role}`);
    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.user.userId,
        action: 'DELETE_USER',
        targetId: userId,
        details: 'User deleted by admin'
      }
    });

    logger.info(`Admin ${req.user.userId} deleted user ${userId}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get system statistics (admin only)
router.get('/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalConnections,
      totalMessages,
      totalInvites,
      activeUsers,
      recentUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.connection.count({ where: { status: 'APPROVED' } }),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.inviteCode.count(),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: recentUsers
      },
      connections: totalConnections,
      messages: totalMessages,
      invites: totalInvites
    });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get admin logs (admin only)
router.get('/logs', authenticate, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adminLog.count()
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching admin logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get system logs (admin only)
router.get('/system-logs', authenticate, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, level } = req.query;
    const skip = (page - 1) * limit;

    const where = level ? { level } : {};

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.systemLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching system logs:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// Get all connections (admin only)
router.get('/connections', authenticate, isAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [connections, total] = await Promise.all([
      prisma.connection.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          friend: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.connection.count({ where })
    ]);

    res.json({
      connections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Delete connection (admin only)
router.delete('/connections/:connectionId', authenticate, isAdmin, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);

    await prisma.connection.delete({
      where: { id: connectionId }
    });

    await prisma.adminLog.create({
      data: {
        adminId: req.user.userId,
        action: 'DELETE_CONNECTION',
        targetId: connectionId,
        details: 'Connection deleted by admin'
      }
    });

    logger.info(`Admin ${req.user.userId} deleted connection ${connectionId}`);
    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    logger.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

module.exports = router;
