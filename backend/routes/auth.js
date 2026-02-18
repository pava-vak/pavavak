const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const passport = require('passport');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, inviteCode } = req.body;

    // Validate invite code
    const invite = await prisma.invite_codes.findUnique({
      where: { code: inviteCode.toUpperCase() }
    });

    if (!invite || invite.used) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or used invite code' 
      });
    }

    // Check expiration (24 hours)
    const expirationTime = new Date(invite.created_at);
    expirationTime.setHours(expirationTime.getHours() + 24);
    
    if (new Date() > expirationTime) {
      return res.status(400).json({
        success: false,
        error: 'Invite code expired'
      });
    }

    // Check if user exists
    const existing = await prisma.users.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false,
        error: 'Username or email already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.users.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName,
        is_approved: false,
        is_admin: false
      }
    });

    // Mark invite as used
    await prisma.invite_codes.update({
      where: { code: inviteCode.toUpperCase() },
      data: {
        used: true,
        used_by_user_id: user.user_id
      }
    });

    res.json({
      success: true,
      message: 'Registration successful! Pending approval.',
      user: {
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Registration failed' 
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.users.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!user.is_approved) {
      return res.status(403).json({
        success: false,
        error: 'Account pending approval'
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (user.two_factor_enabled) {
      req.session.pending2FA = {
        userId: user.user_id,
        timestamp: Date.now()
      };

      return res.json({
        success: true,
        requires2FA: true
      });
    }

    req.login(user, async (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }

      await prisma.users.update({
        where: { user_id: user.user_id },
        data: { last_login: new Date() }
      });

      res.json({
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin
        },
        redirect: user.is_admin ? '/admin.html' : '/chat.html'
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        userId: req.user.user_id,
        username: req.user.username,
        fullName: req.user.full_name,
        email: req.user.email,
        isAdmin: req.user.is_admin
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    req.session.destroy(() => {
      res.json({
        success: true,
        message: 'Logged out'
      });
    });
  });
});

module.exports = router;