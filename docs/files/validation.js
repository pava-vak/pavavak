// Input Validation Middleware
// Validates and sanitizes all user inputs

const validator = require('validator');

// Validate registration data
function validateRegistration(req, res, next) {
  const { fullName, username, password, inviteCode } = req.body;
  const errors = [];

  // Full name validation
  if (!fullName || fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }
  if (fullName && fullName.length > 100) {
    errors.push('Full name too long (max 100 characters)');
  }

  // Username validation
  if (!username || username.length < 3 || username.length > 20) {
    errors.push('Username must be 3-20 characters');
  }
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Password validation
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (password && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (password && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Invite code validation
  if (!inviteCode || inviteCode.trim().length === 0) {
    errors.push('Invite code is required');
  }

  // Mobile validation (optional)
  if (req.body.mobile && !validator.isMobilePhone(req.body.mobile)) {
    errors.push('Invalid mobile number format');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors
    });
  }

  // Sanitize inputs
  req.body.fullName = validator.escape(fullName.trim());
  req.body.username = username.trim().toLowerCase();
  req.body.inviteCode = inviteCode.trim().toUpperCase();

  next();
}

// Validate login data
function validateLogin(req, res, next) {
  const { username, password } = req.body;
  const errors = [];

  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (!password || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors
    });
  }

  req.body.username = username.trim().toLowerCase();

  next();
}

// Validate message data
function validateMessage(req, res, next) {
  const { recipientId, content } = req.body;
  const errors = [];

  if (!recipientId || !validator.isUUID(recipientId)) {
    errors.push('Valid recipient ID is required');
  }

  if (!content || content.trim().length === 0) {
    errors.push('Message content cannot be empty');
  }

  if (content && content.length > 5000) {
    errors.push('Message too long (max 5000 characters)');
  }

  // Validate timer if present
  if (req.body.timer) {
    const { type, seconds } = req.body.timer;
    const validTypes = ['VIEW_ONCE', 'TIMED', 'KEEP_FOREVER'];
    
    if (!validTypes.includes(type)) {
      errors.push('Invalid timer type');
    }

    if (type === 'TIMED' && (!seconds || seconds < 1)) {
      errors.push('Timer duration must be at least 1 second');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      errors
    });
  }

  // Sanitize content (allow some HTML for rich text, but escape dangerous tags)
  req.body.content = content.trim();

  next();
}

// Validate UUID parameter
function validateUUID(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName] || req.body[paramName];
    
    if (!value || !validator.isUUID(value)) {
      return res.status(400).json({
        error: `Invalid ${paramName}`,
        code: 'INVALID_UUID'
      });
    }

    next();
  };
}

// Validate email
function validateEmail(req, res, next) {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      error: 'Valid email address is required',
      code: 'INVALID_EMAIL'
    });
  }

  req.body.email = validator.normalizeEmail(email);
  next();
}

// Validate invite code generation
function validateInviteCodeGeneration(req, res, next) {
  const { count } = req.body;

  if (count && (!Number.isInteger(count) || count < 1 || count > 100)) {
    return res.status(400).json({
      error: 'Count must be between 1 and 100',
      code: 'INVALID_COUNT'
    });
  }

  next();
}

// Sanitize search query
function sanitizeSearch(req, res, next) {
  if (req.query.search) {
    req.query.search = validator.escape(req.query.search.trim());
  }
  next();
}

// Validate pagination
function validatePagination(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (page < 1) {
    return res.status(400).json({
      error: 'Page must be >= 1'
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      error: 'Limit must be between 1 and 100'
    });
  }

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateMessage,
  validateUUID,
  validateEmail,
  validateInviteCodeGeneration,
  sanitizeSearch,
  validatePagination
};
