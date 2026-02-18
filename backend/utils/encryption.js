const crypto = require('crypto');

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_KEY = Buffer.from(KEY.slice(0, 64), 'hex');

/**
 * Encrypt a message
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text with IV and auth tag
 */
function encryptMessage(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt a message
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} Decrypted plain text
 */
function decryptMessage(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted message format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Hash a password
 * @param {string} text - Text to hash
 * @returns {string} Hashed text
 */
function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a random token
 * @param {number} length - Length of token in bytes (default: 32)
 * @returns {string} Random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt backup data
 * @param {string} data - Data to encrypt
 * @param {string} password - Backup password
 * @returns {string} Encrypted backup
 */
function encryptBackup(data, password) {
  try {
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Backup encryption error:', error);
    throw new Error('Failed to encrypt backup');
  }
}

/**
 * Decrypt backup data
 * @param {string} encryptedData - Encrypted backup
 * @param {string} password - Backup password
 * @returns {string} Decrypted data
 */
function decryptBackup(encryptedData, password) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted backup format');
    }
    
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Backup decryption error:', error);
    throw new Error('Failed to decrypt backup - incorrect password');
  }
}

module.exports = {
  encryptMessage,
  decryptMessage,
  hashText,
  generateToken,
  encryptBackup,
  decryptBackup
};
