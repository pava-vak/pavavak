const validator = require('validator');

/**
 * Validate registration input
 */
function validateRegistration(req, res, next) {
  const { username, email, password, inviteCode } = req.body;
  const errors = [];

  // Username validation
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  if (username && username.length > 30) {
    errors.push('Username must be less than 30 characters');
  }
  if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  // Email validation
  if (!email || !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  // Password validation
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (password && !/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (password && !/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (password && !/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Invite code validation
  if (!inviteCode || inviteCode.trim().length === 0) {
    errors.push('Invite code is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Validate login input
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Validate message input
 */
function validateMessage(req, res, next) {
  const { recipientId, content, timer } = req.body;
  const errors = [];

  if (!recipientId || !Number.isInteger(recipientId)) {
    errors.push('Valid recipient ID is required');
  }

  if (!content || content.trim().length === 0) {
    errors.push('Message content is required');
  }

  if (content && content.length > 10000) {
    errors.push('Message content must be less than 10000 characters');
  }

  if (timer !== undefined && (!Number.isInteger(timer) || timer < 0)) {
    errors.push('Timer must be a positive integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Validate invite code generation
 */
function validateInviteGeneration(req, res, next) {
  const { expiresInDays } = req.body;
  const errors = [];

  if (expiresInDays !== undefined) {
    if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
      errors.push('Expiration must be between 1 and 365 days');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Validate profile update
 */
function validateProfileUpdate(req, res, next) {
  const { username, email } = req.body;
  const errors = [];

  if (username !== undefined) {
    if (username.trim().length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    if (username.length > 30) {
      errors.push('Username must be less than 30 characters');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }
  }

  if (email !== undefined && !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Validate password change
 */
function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  if (!currentPassword || currentPassword.length === 0) {
    errors.push('Current password is required');
  }

  if (!newPassword || newPassword.length < 8) {
    errors.push('New password must be at least 8 characters');
  }

  if (newPassword && !/(?=.*[a-z])/.test(newPassword)) {
    errors.push('New password must contain at least one lowercase letter');
  }

  if (newPassword && !/(?=.*[A-Z])/.test(newPassword)) {
    errors.push('New password must contain at least one uppercase letter');
  }

  if (newPassword && !/(?=.*\d)/.test(newPassword)) {
    errors.push('New password must contain at least one number');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}

/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(req, res, next) {
  // Sanitize string fields
  const sanitizeString = (str) => {
    if (typeof str === 'string') {
      return validator.escape(str.trim());
    }
    return str;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateMessage,
  validateInviteGeneration,
  validateProfileUpdate,
  validatePasswordChange,
  sanitizeInput
};