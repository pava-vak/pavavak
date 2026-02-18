// Authentication Routes
// Handles login, registration, 2FA, and logout

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { isAuthenticated } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { sendOTPEmail, generateTOTP, verifyTOTP } = require('../utils/twoFactor');
const { logActivity } = require('../utils/logger');

const prisma = new PrismaClient();

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { fullName, username, password, mobile, inviteCode } = req.body;

    // Verify invite code
    const invite = await prisma.inviteCode.findFirst({
      where: {
        code: inviteCode,
        usedBy: null,
        expiresAt: { gt: new Date() },
        isRevoked: false
      }
    });

    if (!invite) {
      return res.status(400).json({
        error: 'Invalid or expired invite code',
        code: 'INVALID_INVITE'
      });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Username already taken',
        code: 'USERNAME_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        fullName,
        username,
        passwordHash,
        mobile,
        status: 'PENDING',
        role: 'USER',
        inviteCodeUsed: invite.id
      }
    });

    // Mark invite code as used
    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedBy: user.id,
        usedAt: new Date()
      }
    });

    // Log registration
    await logActivity('USER_REGISTERED', {
      userId: user.id,
      username: user.username
    });

    res.status(201).json({
      message: 'Registration successful. Awaiting admin approval.',
      userId: user.id,
      status: 'PENDING'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login
router.post('/login', loginRateLimiter, validateLogin, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Log login attempt
    const logAttempt = async (success, reason = null) => {
      await prisma.loginAttempt.create({
        data: {
          username,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success,
          failureReason: reason
        }
      });
    };

    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      await logAttempt(false, 'User not found');
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is approved
    if (user.status !== 'APPROVED') {
      await logAttempt(false, `Status: ${user.status}`);
      return res.status(403).json({
        error: user.status === 'PENDING' 
          ? 'Account pending approval' 
          : 'Account suspended',
        code: user.status
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      await logAttempt(false, 'Invalid password');
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA
      const tempToken = uuidv4();
      req.session.tempUserId = user.id;
      req.session.tempToken = tempToken;
      req.session.rememberMe = rememberMe;

      // Send OTP if email method
      if (user.twoFactorMethod === 'EMAIL') {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp;
        req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await sendOTPEmail(user.email, otp);
      }

      return res.json({
        require2FA: true,
        method: user.twoFactorMethod,
        tempToken
      });
    }

    // Create session
    const sessionToken = uuidv4();
    const maxAge = rememberMe 
      ? parseInt(process.env.SESSION_REMEMBER_MAX_AGE) 
      : parseInt(process.env.SESSION_MAX_AGE);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt: new Date(Date.now() + maxAge),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() }
    });

    // Set session
    req.session.userId = user.id;
    req.session.sessionToken = sessionToken;
    req.session.cookie.maxAge = maxAge;

    await logAttempt(true);
    await logActivity('USER_LOGIN', { userId: user.id });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Verify 2FA
router.post('/verify-2fa', async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.session.tempUserId;

    if (!userId) {
      return res.status(400).json({
        error: 'No 2FA session found',
        code: 'NO_2FA_SESSION'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    let valid = false;

    // Verify based on method
    if (user.twoFactorMethod === 'EMAIL') {
      const { otp, otpExpires } = req.session;
      if (otp && otpExpires > Date.now() && otp === code) {
        valid = true;
      }
    } else if (user.twoFactorMethod === 'AUTHENTICATOR') {
      valid = verifyTOTP(user.twoFactorSecret, code);
    }

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid verification code',
        code: 'INVALID_2FA_CODE'
      });
    }

    // Create session
    const sessionToken = uuidv4();
    const maxAge = req.session.rememberMe
      ? parseInt(process.env.SESSION_REMEMBER_MAX_AGE)
      : parseInt(process.env.SESSION_MAX_AGE);

    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt: new Date(Date.now() + maxAge),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Clear temp session data
    delete req.session.tempUserId;
    delete req.session.tempToken;
    delete req.session.otp;
    delete req.session.otpExpires;

    // Set real session
    req.session.userId = user.id;
    req.session.sessionToken = sessionToken;
    req.session.cookie.maxAge = maxAge;

    await logActivity('USER_LOGIN_2FA', { userId: user.id });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      error: '2FA verification failed',
      code: '2FA_ERROR'
    });
  }
});

// Logout
router.post('/logout', isAuthenticated, async (req, res) => {
  try {
    // Delete session from database
    await prisma.session.deleteMany({
      where: {
        userId: req.user.id,
        sessionToken: req.session.sessionToken
      }
    });

    // Log logout
    await logActivity('USER_LOGOUT', { userId: req.user.id });

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.json({ message: 'Logout successful' });
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Check auth status
router.get('/status', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true
      }
    });

    if (!user || user.status !== 'APPROVED') {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user
    });

  } catch (error) {
    res.json({ authenticated: false });
  }
});

// Enable 2FA
router.post('/enable-2fa', isAuthenticated, async (req, res) => {
  try {
    const { method, email } = req.body;

    if (method === 'AUTHENTICATOR') {
      const { secret, qrCode } = generateTOTP(req.user.username);
      
      // Store secret temporarily (user must verify before enabling)
      req.session.pending2FASecret = secret;

      res.json({
        qrCode,
        secret,
        message: 'Scan QR code and verify to enable 2FA'
      });

    } else if (method === 'EMAIL') {
      if (!email) {
        return res.status(400).json({
          error: 'Email required for email 2FA'
        });
      }

      // Update user email if provided
      await prisma.user.update({
        where: { id: req.user.id },
        data: { email }
      });

      // Send test OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      req.session.pending2FAOTP = otp;
      req.session.pending2FAMethod = 'EMAIL';

      await sendOTPEmail(email, otp);

      res.json({
        message: 'Verification code sent to email'
      });
    }

  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({
      error: 'Failed to enable 2FA'
    });
  }
});

// Verify and activate 2FA
router.post('/verify-2fa-setup', isAuthenticated, async (req, res) => {
  try {
    const { code } = req.body;
    let valid = false;
    let secret = null;
    let method = null;

    if (req.session.pending2FASecret) {
      // Authenticator verification
      valid = verifyTOTP(req.session.pending2FASecret, code);
      secret = req.session.pending2FASecret;
      method = 'AUTHENTICATOR';
    } else if (req.session.pending2FAOTP) {
      // Email verification
      valid = req.session.pending2FAOTP === code;
      method = 'EMAIL';
    }

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid verification code'
      });
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorMethod: method
      }
    });

    // Clear pending session data
    delete req.session.pending2FASecret;
    delete req.session.pending2FAOTP;
    delete req.session.pending2FAMethod;

    await logActivity('2FA_ENABLED', {
      userId: req.user.id,
      method
    });

    res.json({
      message: '2FA enabled successfully',
      method
    });

  } catch (error) {
    console.error('2FA setup verification error:', error);
    res.status(500).json({
      error: 'Failed to verify 2FA setup'
    });
  }
});

// Disable 2FA
router.post('/disable-2fa', isAuthenticated, async (req, res) => {
  try {
    const { password } = req.body;

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid password'
      });
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorMethod: null
      }
    });

    await logActivity('2FA_DISABLED', { userId: req.user.id });

    res.json({
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({
      error: 'Failed to disable 2FA'
    });
  }
});

module.exports = router;
