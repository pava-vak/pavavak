// User Controller
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const prisma = require('../lib/prisma');

// GET /api/users/me - Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: req.user.user_id },
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

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user profile'
    });
  }
};

// PUT /api/users/me - Update current user profile
exports.updateProfile = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.user.user_id;
    const { fullName, email } = req.body;

    // Validate email if changed
    if (email && email !== req.user.email) {
      const existingUser = await prisma.users.findFirst({
        where: {
          email: email.toLowerCase(),
          NOT: { user_id: userId }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { user_id: userId },
      data: {
        full_name: fullName || req.user.full_name,
        email: email ? email.toLowerCase() : req.user.email
      },
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        is_admin: true,
        two_factor_enabled: true
      }
    });

    logger.info(`User profile updated: ${updatedUser.username}`);

    res.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

// PUT /api/users/me/password - Change password
exports.changePassword = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.user.user_id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters'
      });
    }

    // Get user with password
    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.users.update({
      where: { user_id: userId },
      data: { password_hash: newPasswordHash }
    });

    logger.info(`Password changed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

// GET /api/users/:userId - Get another user's public profile
exports.getUserProfile = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const currentUserId = req.user.user_id;
    const targetUserId = parseInt(req.params.userId);

    // Check if connection exists
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: currentUserId, user2_id: targetUserId },
          { user1_id: targetUserId, user2_id: currentUserId }
        ],
        status: 'active'
      }
    });

    if (!connection && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'No connection with this user'
      });
    }

    // Get user public profile
    const user = await prisma.users.findUnique({
      where: { user_id: targetUserId },
      select: {
        user_id: true,
        username: true,
        full_name: true,
        created_at: true,
        last_login: true
        // Note: email and other sensitive fields not included
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user profile'
    });
  }
};

// POST /api/users/search - Search for users
exports.searchUsers = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { query } = req.body;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    // Search users (only admins can search all users)
    let whereClause = {
      OR: [
        { username: { contains: query.toLowerCase() } },
        { full_name: { contains: query, mode: 'insensitive' } }
      ],
      is_approved: true
    };

    // Non-admins can only see users they're connected with
    if (!req.user.is_admin) {
      const userId = req.user.user_id;

      // Get connected user IDs
      const connections = await prisma.connections.findMany({
        where: {
          OR: [
            { user1_id: userId },
            { user2_id: userId }
          ],
          status: 'active'
        }
      });

      const connectedUserIds = connections.map(conn => 
        conn.user1_id === userId ? conn.user2_id : conn.user1_id
      );

      whereClause.user_id = { in: connectedUserIds };
    }

    const users = await prisma.users.findMany({
      where: whereClause,
      take: 20,
      select: {
        user_id: true,
        username: true,
        full_name: true,
        created_at: true
      },
      orderBy: { username: 'asc' }
    });

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users'
    });
  }
};

module.exports = exports;
