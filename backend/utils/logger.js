// Logging Utility
// Handles all system and user activity logging

const prisma = require('../lib/prisma');

// Log levels
const LogLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
};

// Log activity to database
async function logActivity(action, metadata = {}, level = LogLevel.INFO) {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        action,
        message: generateMessage(action, metadata),
        metadata: metadata
      }
    });

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level}] ${action}:`, metadata);
    }
  } catch (error) {
    // Fallback to console if database logging fails
    console.error('Failed to log to database:', error);
    console.log(`[${level}] ${action}:`, metadata);
  }
}

// Generate human-readable message from action and metadata
function generateMessage(action, metadata) {
  const messages = {
    'USER_REGISTERED': `User registered: ${metadata.username}`,
    'USER_LOGIN': `User logged in: ${metadata.userId}`,
    'USER_LOGIN_2FA': `User logged in with 2FA: ${metadata.userId}`,
    'USER_LOGOUT': `User logged out: ${metadata.userId}`,
    '2FA_ENABLED': `2FA enabled (${metadata.method}): ${metadata.userId}`,
    '2FA_DISABLED': `2FA disabled: ${metadata.userId}`,
    'MESSAGE_SENT': `Message sent: ${metadata.messageId}`,
    'MESSAGE_DELETED': `Message deleted: ${metadata.messageId}`,
    'CONNECTION_CREATED': `Connection created: ${metadata.userA} ↔ ${metadata.userB}`,
    'CONNECTION_REMOVED': `Connection removed: ${metadata.connectionId}`,
    'INVITE_CODE_GENERATED': `Invite code generated: ${metadata.code}`,
    'INVITE_CODE_USED': `Invite code used: ${metadata.code}`,
    'USER_APPROVED': `User approved: ${metadata.userId}`,
    'USER_REJECTED': `User rejected: ${metadata.userId}`,
    'USER_BANNED': `User banned: ${metadata.userId}`,
    'ADMIN_ACTION': `Admin action: ${metadata.action}`,
    'SERVER_START': 'Server started',
    'SERVER_SHUTDOWN': 'Server shutdown',
    'DATABASE_ERROR': `Database error: ${metadata.error}`,
    'AUTH_ERROR': `Authentication error: ${metadata.error}`
  };

  return messages[action] || `${action}: ${JSON.stringify(metadata)}`;
}

// Log error
async function logError(error, context = {}) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    ...context
  };

  await logActivity('ERROR', errorData, LogLevel.ERROR);
}

// Log warning
async function logWarning(message, metadata = {}) {
  await logActivity(message, metadata, LogLevel.WARNING);
}

// Log info
async function logInfo(message, metadata = {}) {
  await logActivity(message, metadata, LogLevel.INFO);
}

// Log debug (only in development)
async function logDebug(message, metadata = {}) {
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    await logActivity(message, metadata, LogLevel.DEBUG);
  }
}

// Get recent logs
async function getRecentLogs(limit = 100, level = null) {
  try {
    const where = level ? { level } : {};
    
    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return logs;
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    return [];
  }
}

// Search logs
async function searchLogs(query, options = {}) {
  const {
    startDate,
    endDate,
    level,
    action,
    limit = 100
  } = options;

  try {
    const where = {};

    if (query) {
      where.OR = [
        { message: { contains: query, mode: 'insensitive' } },
        { action: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (level) {
      where.level = level;
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return logs;
  } catch (error) {
    console.error('Log search failed:', error);
    return [];
  }
}

// Clean old logs (keep last 90 days)
async function cleanOldLogs() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await prisma.systemLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
        level: { not: 'ERROR' } // Keep errors longer
      }
    });

    await logInfo('OLD_LOGS_CLEANED', {
      count: result.count,
      before: cutoffDate.toISOString()
    });

    return result.count;
  } catch (error) {
    console.error('Failed to clean old logs:', error);
    return 0;
  }
}

// Export logs to JSON
async function exportLogs(options = {}) {
  try {
    const logs = await searchLogs('', options);
    return JSON.stringify(logs, null, 2);
  } catch (error) {
    console.error('Log export failed:', error);
    return null;
  }
}

module.exports = {
  logActivity,
  logError,
  logWarning,
  logInfo,
  logDebug,
  getRecentLogs,
  searchLogs,
  cleanOldLogs,
  exportLogs,
  LogLevel,
  // Simple synchronous methods for compatibility with old routes
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
};