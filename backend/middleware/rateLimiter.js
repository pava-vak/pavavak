// Rate Limiting Middleware
// Prevents abuse and DOS attacks

const rateLimit = require('express-rate-limit');

// Login rate limiter - strict
const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts
  message: {
    error: 'Too many login attempts. Please try again in 1 hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// API rate limiter - moderate
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Message sending rate limiter
const messageSendRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: {
    error: 'Too many messages. Please slow down.',
    code: 'MESSAGE_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user ? req.user.id : req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Sending messages too fast',
      code: 'MESSAGE_RATE_LIMIT',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Registration rate limiter - very strict
const registrationRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 registrations per day per IP
  message: {
    error: 'Too many registration attempts. Please try again tomorrow.',
    code: 'REGISTRATION_RATE_LIMIT'
  }
});

// Invite code generation rate limiter
const inviteGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 codes per hour
  message: {
    error: 'Too many invite codes generated',
    code: 'INVITE_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

// 2FA verification rate limiter
const twoFactorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    error: 'Too many 2FA attempts',
    code: '2FA_RATE_LIMIT'
  },
  skipSuccessfulRequests: true // Don't count successful verifications
});

// Admin actions rate limiter
const adminActionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 admin actions per minute
  message: {
    error: 'Too many admin actions',
    code: 'ADMIN_RATE_LIMIT'
  },
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  }
});

module.exports = {
  loginRateLimiter,
  apiRateLimiter,
  messageSendRateLimiter,
  registrationRateLimiter,
  inviteGenerationRateLimiter,
  twoFactorRateLimiter,
  adminActionRateLimiter
};
