// ============================================================
// PaVa-Vak Auth Routes  |  routes/auth.js
// Routes: register, login, session, logout, verify-2fa,
//         verify-password (new — used by applock forgot PIN)
// ============================================================

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma'); // shared singleton
const bcrypt = require('bcrypt');
const passport = require('passport');

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, inviteCode } = req.body;

    if (!username || !email || !password || !fullName || !inviteCode) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    // Validate invite code
    const invite = await prisma.invite_codes.findUnique({
      where: { code: inviteCode.toUpperCase() }
    });

    if (!invite || invite.used) {
      return res.status(400).json({ success: false, error: 'Invalid or used invite code' });
    }

    // Check expiration (24 hours)
    const expirationTime = new Date(invite.created_at);
    expirationTime.setHours(expirationTime.getHours() + 24);
    if (new Date() > expirationTime) {
      return res.status(400).json({ success: false, error: 'Invite code expired' });
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
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
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
      data: { used: true, used_by_user_id: user.user_id }
    });

    res.json({
      success: true,
      message: 'Registration successful! Pending approval.',
      user: { username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const user = await prisma.users.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ success: false, error: 'Account pending approval' });
    }

    const now = new Date();
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    const canUseResetOtp =
      !!user.reset_otp_hash &&
      !!user.reset_otp_expiry &&
      user.reset_otp_expiry > now;
    const isResetOtpValid = canUseResetOtp
      ? await bcrypt.compare(password, user.reset_otp_hash)
      : false;

    if (!isPasswordValid && !isResetOtpValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const loginViaResetOtp = isResetOtpValid;
    const requiresPasswordReset = !!user.force_password_reset || loginViaResetOtp;

    // 2FA required
    if (user.two_factor_enabled) {
      req.session.pending2FA = {
        userId: user.user_id,
        timestamp: Date.now(),
        loginViaResetOtp,
        requiresPasswordReset
      };
      return res.json({ success: true, requires2FA: true, requiresPasswordReset });
    }

    req.login(user, async (err) => {
      if (err) return res.status(500).json({ success: false, error: 'Login failed' });

      const updateData = {
        last_login: new Date()
      };
      if (loginViaResetOtp) {
        updateData.force_password_reset = true;
        updateData.reset_otp_hash = null;
        updateData.reset_otp_expiry = null;
        updateData.reset_otp_used_at = new Date();
      }

      await prisma.users.update({
        where: { user_id: user.user_id },
        data: updateData
      });

      res.json({
        success: true,
        requiresPasswordReset,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin,
          forcePasswordReset: requiresPasswordReset
        },
        redirect: user.is_admin ? '/admin.html' : '/chat.html'
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-2fa
// Was MISSING from original auth.js — added here
// ─────────────────────────────────────────────────────────────
router.post('/verify-2fa', async (req, res) => {
  try {
    const pending = req.session.pending2FA;

    if (!pending) {
      return res.status(400).json({ success: false, error: 'No 2FA session found' });
    }

    // 5 minute timeout
    if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
      delete req.session.pending2FA;
      return res.status(400).json({ success: false, error: '2FA session expired. Please login again.' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code required' });
    }

    const user = await prisma.users.findUnique({ where: { user_id: pending.userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let speakeasy;
    try {
      speakeasy = require('speakeasy');
    } catch (e) {
      console.error('speakeasy not installed');
      return res.status(500).json({ success: false, error: '2FA module not available' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ success: false, error: 'Invalid 2FA code' });
    }

    delete req.session.pending2FA;

    req.login(user, async (err) => {
      if (err) return res.status(500).json({ success: false, error: 'Login failed' });

      const updateData = {
        last_login: new Date()
      };
      if (pending.loginViaResetOtp) {
        updateData.force_password_reset = true;
        updateData.reset_otp_hash = null;
        updateData.reset_otp_expiry = null;
        updateData.reset_otp_used_at = new Date();
      }

      await prisma.users.update({
        where: { user_id: user.user_id },
        data: updateData
      });

      res.json({
        success: true,
        requiresPasswordReset: !!pending.requiresPasswordReset,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin,
          forcePasswordReset: !!pending.requiresPasswordReset
        },
        redirect: user.is_admin ? '/admin.html' : '/chat.html'
      });
    });

  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/session
// ─────────────────────────────────────────────────────────────
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
        isAdmin: req.user.is_admin,
        forcePasswordReset: !!req.user.force_password_reset
      }
    });
  } else {
    res.json({ success: true, authenticated: false });
  }
});

// POST /api/auth/request-password-reset
// User submits forgot-password request for admin review.
router.post('/request-password-reset', async (req, res) => {
  try {
    const identifierRaw = req.body?.usernameOrEmail || req.body?.username || req.body?.email;
    const identifier = String(identifierRaw || '').trim().toLowerCase();
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Username or email required' });
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier }
        ]
      },
      select: { user_id: true }
    });

    if (user) {
      const existingPending = await prisma.password_reset_requests.findFirst({
        where: { user_id: user.user_id, status: 'pending' },
        select: { request_id: true }
      });

      if (!existingPending) {
        await prisma.password_reset_requests.create({
          data: {
            user_id: user.user_id,
            status: 'pending'
          }
        });
      }
    }

    // Do not reveal whether account exists.
    return res.json({
      success: true,
      message: 'If the account exists, admin has been notified.'
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit reset request' });
  }
});

// POST /api/auth/complete-password-reset
// Requires active session. Used after OTP login to force new password.
router.post('/complete-password-reset', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const newPassword = String(req.body?.newPassword || '').trim();
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: req.user.user_id },
      select: { force_password_reset: true }
    });

    if (!user?.force_password_reset) {
      return res.status(400).json({ success: false, error: 'Password reset is not required' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.users.update({
      where: { user_id: req.user.user_id },
      data: {
        password_hash: passwordHash,
        force_password_reset: false,
        reset_otp_hash: null,
        reset_otp_expiry: null,
        reset_otp_used_at: null,
        reset_token: null,
        reset_token_expiry: null
      }
    });

    return res.json({ success: true, message: 'Password reset complete' });
  } catch (error) {
    console.error('Complete password reset error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out' });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-password
// Used by applock.js forgot PIN flow.
// Verifies account password without changing session state.
// ─────────────────────────────────────────────────────────────
router.post('/verify-password', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password required' });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: req.user.user_id }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Incorrect password' });
    }
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

module.exports = router;
