const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, email } = req.body;

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    // Check if username/email already exists
    if (username || email) {
      const existing = await prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            username ? { username } : {},
            email ? { email } : {}
          ]
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Username or email already taken' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        username: true,
        email: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLogin: true
      }
    });

    logger.info(`User ${userId} updated profile`);
    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    logger.info(`User ${userId} changed password`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get user statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const totalConnections = await prisma.connection.count({
      where: {
        OR: [
          { userId: userId, status: 'APPROVED' },
          { friendId: userId, status: 'APPROVED' }
        ]
      }
    });

    const pendingRequests = await prisma.connection.count({
      where: {
        friendId: userId,
        status: 'PENDING'
      }
    });

    const sentMessages = await prisma.message.count({
      where: {
        senderId: userId,
        deletedAt: null
      }
    });

    const receivedMessages = await prisma.message.count({
      where: {
        recipientId: userId,
        deletedAt: null
      }
    });

    const unreadMessages = await prisma.message.count({
      where: {
        recipientId: userId,
        readAt: null,
        deletedAt: null
      }
    });

    const inviteCodesGenerated = await prisma.inviteCode.count({
      where: { createdBy: userId }
    });

    const inviteCodesUsed = await prisma.inviteCode.count({
      where: {
        createdBy: userId,
        usedAt: { not: null }
      }
    });

    res.json({
      connections: totalConnections,
      pendingRequests,
      messages: {
        sent: sentMessages,
        received: receivedMessages,
        unread: unreadMessages
      },
      invites: {
        generated: inviteCodesGenerated,
        used: inviteCodesUsed
      }
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Delete account
router.delete('/account', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Delete user and cascade delete all related data
    await prisma.user.delete({
      where: { id: userId }
    });

    logger.info(`User ${userId} deleted their account`);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Search users (for connections)
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      },
      take: 10
    });

    res.json(users);
  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
