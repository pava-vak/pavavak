const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const logger = require('./logger');

/**
 * Generate 2FA secret for a user
 * @param {string} username - User's username
 * @param {string} appName - Application name
 * @returns {Object} Secret and QR code URL
 */
async function generate2FASecret(username, appName = 'PaVa-Vak') {
  try {
    const secret = speakeasy.generateSecret({
      name: `${appName} (${username})`,
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpAuthUrl: secret.otpauth_url
    };
  } catch (error) {
    logger.error('Error generating 2FA secret:', error);
    throw new Error('Failed to generate 2FA secret');
  }
}

/**
 * Verify 2FA token
 * @param {string} secret - User's 2FA secret
 * @param {string} token - Token to verify
 * @returns {boolean} True if token is valid
 */
function verify2FAToken(secret, token) {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps before/after (60 seconds total window)
    });

    return verified;
  } catch (error) {
    logger.error('Error verifying 2FA token:', error);
    return false;
  }
}

/**
 * Generate backup codes
 * @param {number} count - Number of backup codes to generate
 * @returns {Array<string>} Array of backup codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup code for storage
 * @param {string} code - Backup code
 * @returns {string} Hashed code
 */
function hashBackupCode(code) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify backup code
 * @param {string} code - Code to verify
 * @param {Array<string>} hashedCodes - Array of hashed backup codes
 * @returns {number} Index of matched code, or -1 if not found
 */
function verifyBackupCode(code, hashedCodes) {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.findIndex(hashedCode => hashedCode === hashedInput);
}

/**
 * Generate temporary 2FA bypass token (for account recovery)
 * @returns {string} Bypass token
 */
function generateBypassToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get current TOTP token (for testing/debugging)
 * @param {string} secret - User's 2FA secret
 * @returns {string} Current token
 */
function getCurrentToken(secret) {
  try {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
  } catch (error) {
    logger.error('Error getting current token:', error);
    return null;
  }
}

/**
 * Validate 2FA setup
 * @param {string} secret - Secret to validate
 * @param {string} token - Token to verify against
 * @returns {Object} Validation result
 */
async function validate2FASetup(secret, token) {
  try {
    const isValid = verify2FAToken(secret, token);
    
    if (isValid) {
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));
      
      return {
        success: true,
        backupCodes,
        hashedBackupCodes
      };
    }
    
    return {
      success: false,
      error: 'Invalid token'
    };
  } catch (error) {
    logger.error('Error validating 2FA setup:', error);
    return {
      success: false,
      error: 'Validation failed'
    };
  }
}

/**
 * Check if token is rate-limited
 * @param {string} userId - User ID
 * @param {Object} rateLimitStore - Store for rate limiting (e.g., Map or Redis)
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} Rate limit status
 */
function check2FARateLimit(userId, rateLimitStore, maxAttempts = 5, windowMs = 300000) {
  const now = Date.now();
  const userAttempts = rateLimitStore.get(userId) || { count: 0, resetAt: now + windowMs };
  
  if (now > userAttempts.resetAt) {
    // Reset window
    userAttempts.count = 0;
    userAttempts.resetAt = now + windowMs;
  }
  
  if (userAttempts.count >= maxAttempts) {
    const remainingTime = Math.ceil((userAttempts.resetAt - now) / 1000);
    return {
      allowed: false,
      remainingTime
    };
  }
  
  userAttempts.count++;
  rateLimitStore.set(userId, userAttempts);
  
  return {
    allowed: true,
    attemptsRemaining: maxAttempts - userAttempts.count
  };
}

module.exports = {
  generate2FASecret,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  generateBypassToken,
  getCurrentToken,
  validate2FASetup,
  check2FARateLimit
};
