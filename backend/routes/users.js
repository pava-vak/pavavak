const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { isAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const MAX_PROFILE_PHOTO_BYTES = Number(process.env.MAX_PROFILE_PHOTO_BYTES || 350 * 1024);

function normalizeProfilePhotoBase64(value) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('Profile photo must be a base64 string');
  const trimmed = value.trim();
  if (!trimmed) return null;
  const bytes = Buffer.from(trimmed, 'base64');
  if (!bytes.length) throw new Error('Profile photo is invalid');
  if (bytes.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error('Profile photo is too large');
  }
  return trimmed;
}

// Get current user profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        profile_photo_base64: true,
        is_admin: true,
        is_approved: true,
        two_factor_enabled: true,
        hide_last_seen: true,
        created_at: true,
        last_login: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePhotoBase64: user.profile_photo_base64,
        isAdmin: user.is_admin,
        isApproved: user.is_approved,
        twoFactorEnabled: user.two_factor_enabled,
        hideLastSeen: user.hide_last_seen,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { fullName, hideLastSeen, profilePhotoBase64, clearProfilePhoto } = req.body || {};
    const data = {};

    if (typeof fullName === 'string') {
      data.full_name = fullName.trim();
    }
    if (typeof hideLastSeen === 'boolean') {
      data.hide_last_seen = hideLastSeen;
    }
    if (clearProfilePhoto === true) {
      data.profile_photo_base64 = null;
    } else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'profilePhotoBase64')) {
      data.profile_photo_base64 = normalizeProfilePhotoBase64(profilePhotoBase64);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'No profile changes provided' });
    }

    await prisma.users.update({
      where: { user_id: userId },
      data
    });

    console.log(`User ${userId} updated profile`);
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    const message = error.message || 'Failed to update profile';
    const status = /profile photo|No profile changes/i.test(message) ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// Change password
router.post('/change-password', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.users.update({
      where: { user_id: userId },
      data: { password_hash: hashedPassword }
    });

    console.log(`User ${userId} changed password`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// Get user statistics
router.get('/stats', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const totalConnections = await prisma.connections.count({
      where: {
        OR: [
          { user1_id: userId, status: 'active' },
          { user2_id: userId, status: 'active' }
        ]
      }
    });

    const sentMessages = await prisma.messages.count({
      where: {
        sender_id: userId
      }
    });

    const receivedMessages = await prisma.messages.count({
      where: {
        receiver_id: userId
      }
    });

    const unreadMessages = await prisma.messages.count({
      where: {
        receiver_id: userId,
        is_read: false
      }
    });

    const inviteCodesGenerated = await prisma.invite_codes.count({
      where: { created_by_user_id: userId }
    });

    const inviteCodesUsed = await prisma.invite_codes.count({
      where: {
        created_by_user_id: userId,
        used: true
      }
    });

    res.json({
      success: true,
      stats: {
        connections: totalConnections,
        messages: {
          sent: sentMessages,
          received: receivedMessages,
          unread: unreadMessages
        },
        invites: {
          generated: inviteCodesGenerated,
          used: inviteCodesUsed
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// Delete account
router.delete('/delete-account', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required to delete account' });
    }

    // Verify password
    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Password is incorrect' });
    }

    // Delete user (cascade will handle related data)
    await prisma.users.delete({
      where: { user_id: userId }
    });

    console.log(`User ${userId} deleted their account`);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

// Search users (for connections)
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.user_id;

    if (!query || query.length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }

    const users = await prisma.users.findMany({
      where: {
        user_id: { not: userId },
        is_approved: true,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { full_name: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        user_id: true,
        username: true,
        email: true,
        full_name: true,
        created_at: true
      },
      take: 10
    });

    const formattedUsers = users.map(user => ({
      userId: user.user_id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      createdAt: user.created_at
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, error: 'Failed to search users' });
  }
});

module.exports = router;
