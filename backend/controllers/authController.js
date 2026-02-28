// Authentication Controller
const bcrypt = require('bcrypt');
const passport = require('passport');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailer');
const { generateTOTP, verifyTOTP } = require('../utils/twoFactor');

const prisma = require('../lib/prisma');

// POST /api/auth/register - User registration with invite code
exports.register = async (req, res) => {
  try {
    const { username, password, email, fullName, inviteCode } = req.body;

    // Validate invite code
    const invite = await prisma.invite_codes.findUnique({
      where: { code: inviteCode.toUpperCase() }
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        error: 'Invite code already used'
      });
    }

    // Check expiration (24 hours)
    const expirationTime = new Date(invite.created_at);
    expirationTime.setHours(expirationTime.getHours() + 24);
    
    if (new Date() > expirationTime) {
      return res.status(400).json({
        success: false,
        error: 'Invite code expired (codes are valid for 24 hours)'
      });
    }

    // Check if username or email already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
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
        password_hash: passwordHash,
        email: email.toLowerCase(),
        full_name: fullName,
        is_approved: false, // Requires admin approval
        is_admin: false
      }
    });

    // Mark invite code as used
    await prisma.invite_codes.update({
      where: { code: inviteCode.toUpperCase() },
      data: {
        used: true,
        used_by_user_id: user.user_id
      }
    });

    logger.info(`New user registered: ${username} (pending approval)`);

    // Send notification email to admins (optional)
    // TODO: Implement admin notification

    res.json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval.',
      user: {
        username: user.username,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

// POST /api/auth/login - User login (step 1)
exports.login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      logger.error('Login error:', err);
      return res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: info?.message || 'Invalid credentials'
      });
    }

    // If 2FA is enabled, don't log in yet
    if (user.two_factor_enabled) {
      // Store user ID in session for 2FA verification
      req.session.pending2FA = {
        userId: user.user_id,
        timestamp: Date.now()
      };

      return res.json({
        success: true,
        requires2FA: true,
        message: 'Please enter your 2FA code'
      });
    }

    // No 2FA, complete login
    req.logIn(user, async (err) => {
      if (err) {
        logger.error('Login session error:', err);
        return res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }

      // Update last login
      await prisma.users.update({
        where: { user_id: user.user_id },
        data: { last_login: new Date() }
      });

      logger.info(`User logged in: ${user.username}`);

      res.json({
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin
        }
      });
    });
  })(req, res, next);
};

// POST /api/auth/verify-2fa - Verify 2FA code (step 2 of login)
exports.verify2FA = async (req, res) => {
  try {
    const { code } = req.body;

    // Check if there's a pending 2FA session
    if (!req.session.pending2FA) {
      return res.status(400).json({
        success: false,
        error: '2FA verification not pending'
      });
    }

    const { userId, timestamp } = req.session.pending2FA;

    // Check if 2FA session expired (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      delete req.session.pending2FA;
      return res.status(400).json({
        success: false,
        error: '2FA session expired. Please login again.'
      });
    }

    // Get user
    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user || !user.two_factor_secret) {
      delete req.session.pending2FA;
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA setup'
      });
    }

    // Verify TOTP code
    const isValid = verifyTOTP(user.two_factor_secret, code);

    if (!isValid) {
      // Log failed attempt
      await prisma.login_attempts.create({
        data: {
          user_id: userId,
          success: false,
          ip_address: req.ip || 'unknown'
        }
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code'
      });
    }

    // 2FA verified, complete login
    delete req.session.pending2FA;

    req.logIn(user, async (err) => {
      if (err) {
        logger.error('Login session error:', err);
        return res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }

      // Update last login
      await prisma.users.update({
        where: { user_id: userId },
        data: { last_login: new Date() }
      });

      // Log successful attempt
      await prisma.login_attempts.create({
        data: {
          user_id: userId,
          success: true,
          ip_address: req.ip || 'unknown'
        }
      });

      logger.info(`User logged in with 2FA: ${user.username}`);

      res.json({
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin
        }
      });
    });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      error: '2FA verification failed'
    });
  }
};

// POST /api/auth/logout - User logout
exports.logout = (req, res) => {
  const username = req.user?.username;

  req.logout((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error:', err);
      }

      if (username) {
        logger.info(`User logged out: ${username}`);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
};

// GET /api/auth/session - Check if user is authenticated
exports.getSession = (req, res) => {
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
        twoFactorEnabled: req.user.two_factor_enabled
      }
    });
  } else {
    res.json({
      success: true,
      authenticated: false
    });
  }
};

// POST /api/auth/setup-2fa - Setup 2FA for user
exports.setup2FA = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.user.user_id;

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `PaVa-Vak (${req.user.username})`,
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Save secret to database (temporarily)
    await prisma.users.update({
      where: { user_id: userId },
      data: {
        two_factor_secret: secret.base32,
        two_factor_enabled: false // Not enabled until verified
      }
    });

    logger.info(`2FA setup initiated for user: ${req.user.username}`);

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      message: 'Scan the QR code with Google Authenticator and verify with a code'
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      error: '2FA setup failed'
    });
  }
};

// POST /api/auth/disable-2fa - Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { code } = req.body;
    const userId = req.user.user_id;

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled'
      });
    }

    // Verify code before disabling
    const isValid = verifyTOTP(user.two_factor_secret, code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid 2FA code'
      });
    }

    // Disable 2FA
    await prisma.users.update({
      where: { user_id: userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null
      }
    });

    logger.info(`2FA disabled for user: ${user.username}`);

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable 2FA'
    });
  }
};

// POST /api/auth/request-password-reset - Request password reset email
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token (simple implementation - use proper tokens in production)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token (you'd need to add these fields to your schema)
    // For now, we'll just log it
    logger.info(`Password reset requested for: ${user.email}, token: ${resetToken}`);

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request - PaVa-Vak',
      text: `Click this link to reset your password: ${process.env.DOMAIN}/reset-password?token=${resetToken}`,
      html: `<p>Click <a href="${process.env.DOMAIN}/reset-password?token=${resetToken}">here</a> to reset your password.</p>`
    });

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
};

// POST /api/auth/reset-password - Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token and get user
    // This is a simplified implementation
    // In production, store tokens in database with expiry

    logger.info(`Password reset attempted with token: ${token}`);

    res.json({
      success: true,
      message: 'Password reset functionality is being implemented'
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset failed'
    });
  }
};

module.exports = exports;
