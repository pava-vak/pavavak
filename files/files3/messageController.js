// Message Controller
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// GET /api/messages/:otherUserId - Get conversation with another user
exports.getConversation = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const otherUserId = parseInt(req.params.otherUserId);

    // Verify connection exists
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: otherUserId },
          { user1_id: otherUserId, user2_id: userId }
        ],
        status: 'active'
      }
    });

    if (!connection) {
      return res.status(403).json({
        success: false,
        error: 'No active connection with this user'
      });
    }

    // Get messages
    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: userId, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: userId }
        ]
      },
      orderBy: {
        sent_at: 'asc'
      },
      include: {
        message_timers: true
      }
    });

    // Get conversation timer settings
    const timerSettings = await prisma.conversation_timer_settings.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: otherUserId },
          { user1_id: otherUserId, user2_id: userId }
        ]
      }
    });

    res.json({
      success: true,
      messages: messages.map(msg => ({
        messageId: msg.message_id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        content: msg.content,
        sentAt: msg.sent_at,
        isRead: msg.is_read,
        readAt: msg.read_at,
        timer: msg.message_timers ? {
          type: msg.message_timers.timer_type,
          duration: msg.message_timers.duration_seconds,
          expiresAt: msg.message_timers.expires_at
        } : null
      })),
      timerSettings: timerSettings ? {
        defaultTimerType: timerSettings.default_timer_type,
        defaultDuration: timerSettings.default_duration_seconds
      } : null
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load conversation'
    });
  }
};

// POST /api/messages/send - Send a message
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.user_id;
    const { receiverId, content, timerType, timerDuration } = req.body;

    // Verify connection exists
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: senderId, user2_id: receiverId },
          { user1_id: receiverId, user2_id: senderId }
        ],
        status: 'active'
      }
    });

    if (!connection) {
      return res.status(403).json({
        success: false,
        error: 'No active connection with this user'
      });
    }

    // Create message
    const message = await prisma.messages.create({
      data: {
        sender_id: senderId,
        receiver_id: receiverId,
        content: content,
        sent_at: new Date(),
        is_read: false
      }
    });

    // Create timer if specified
    let timer = null;
    if (timerType && timerType !== 'keep_forever') {
      let expiresAt = null;
      
      if (timerType === 'view_once') {
        // Will expire when read
        expiresAt = null;
      } else if (timerType === 'timed' && timerDuration) {
        // Will expire after duration from now
        expiresAt = new Date(Date.now() + timerDuration * 1000);
      }

      timer = await prisma.message_timers.create({
        data: {
          message_id: message.message_id,
          timer_type: timerType,
          duration_seconds: timerDuration || null,
          expires_at: expiresAt
        }
      });
    }

    logger.info(`Message sent from ${senderId} to ${receiverId}`);

    // Emit Socket.io event to receiver
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    
    if (onlineUsers.has(receiverId)) {
      io.to(`user_${receiverId}`).emit('new_message', {
        messageId: message.message_id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        content: message.content,
        sentAt: message.sent_at,
        timer: timer ? {
          type: timer.timer_type,
          duration: timer.duration_seconds,
          expiresAt: timer.expires_at
        } : null
      });
    }

    res.json({
      success: true,
      message: {
        messageId: message.message_id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        content: message.content,
        sentAt: message.sent_at,
        timer: timer ? {
          type: timer.timer_type,
          duration: timer.duration_seconds,
          expiresAt: timer.expires_at
        } : null
      }
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

// DELETE /api/messages/:messageId - Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const messageId = parseInt(req.params.messageId);

    // Get message
    const message = await prisma.messages.findUnique({
      where: { message_id: messageId }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Only sender or admin can delete
    if (message.sender_id !== userId && !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this message'
      });
    }

    // Delete message timer first (if exists)
    await prisma.message_timers.deleteMany({
      where: { message_id: messageId }
    });

    // Delete message
    await prisma.messages.delete({
      where: { message_id: messageId }
    });

    logger.info(`Message ${messageId} deleted by user ${userId}`);

    // Emit Socket.io event
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    
    // Notify both sender and receiver
    [message.sender_id, message.receiver_id].forEach(targetUserId => {
      if (onlineUsers.has(targetUserId)) {
        io.to(`user_${targetUserId}`).emit('message_deleted', {
          messageId: messageId
        });
      }
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
};

// PUT /api/messages/:messageId/read - Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const messageId = parseInt(req.params.messageId);

    // Get message
    const message = await prisma.messages.findUnique({
      where: { message_id: messageId },
      include: { message_timers: true }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Only receiver can mark as read
    if (message.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Mark as read
    const updatedMessage = await prisma.messages.update({
      where: { message_id: messageId },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    // Handle view_once timer
    if (message.message_timers && message.message_timers.timer_type === 'view_once') {
      // Set expiration to now + 10 seconds (grace period to view)
      await prisma.message_timers.update({
        where: { message_id: messageId },
        data: {
          expires_at: new Date(Date.now() + 10 * 1000)
        }
      });
    }

    // Emit Socket.io event to sender (read receipt)
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    
    if (onlineUsers.has(message.sender_id)) {
      io.to(`user_${message.sender_id}`).emit('message_read', {
        messageId: messageId,
        readAt: updatedMessage.read_at
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark message as read'
    });
  }
};

// GET /api/messages/conversations/list - Get list of all conversations
exports.getConversationsList = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get all connections
    const connections = await prisma.connections.findMany({
      where: {
        OR: [
          { user1_id: userId },
          { user2_id: userId }
        ],
        status: 'active'
      },
      include: {
        users_connections_user1_idTousers: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        },
        users_connections_user2_idTousers: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        }
      }
    });

    // Get last message for each conversation
    const conversations = await Promise.all(
      connections.map(async (conn) => {
        const otherUser = conn.user1_id === userId 
          ? conn.users_connections_user2_idTousers 
          : conn.users_connections_user1_idTousers;

        // Get last message
        const lastMessage = await prisma.messages.findFirst({
          where: {
            OR: [
              { sender_id: userId, receiver_id: otherUser.user_id },
              { sender_id: otherUser.user_id, receiver_id: userId }
            ]
          },
          orderBy: {
            sent_at: 'desc'
          }
        });

        // Get unread count
        const unreadCount = await prisma.messages.count({
          where: {
            sender_id: otherUser.user_id,
            receiver_id: userId,
            is_read: false
          }
        });

        return {
          user: {
            userId: otherUser.user_id,
            username: otherUser.username,
            fullName: otherUser.full_name
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            sentAt: lastMessage.sent_at,
            isFromMe: lastMessage.sender_id === userId
          } : null,
          unreadCount: unreadCount
        };
      })
    );

    // Sort by last message time
    conversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.sentAt) - new Date(a.lastMessage.sentAt);
    });

    res.json({
      success: true,
      conversations: conversations
    });
  } catch (error) {
    logger.error('Get conversations list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load conversations'
    });
  }
};

// POST /api/messages/timer/set - Set default timer for conversation
exports.setMessageTimer = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { otherUserId, timerType, duration } = req.body;

    // Verify connection exists
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: otherUserId },
          { user1_id: otherUserId, user2_id: userId }
        ],
        status: 'active'
      }
    });

    if (!connection) {
      return res.status(403).json({
        success: false,
        error: 'No active connection with this user'
      });
    }

    // Create or update timer settings
    const timerSettings = await prisma.conversation_timer_settings.upsert({
      where: {
        user1_id_user2_id: {
          user1_id: Math.min(userId, otherUserId),
          user2_id: Math.max(userId, otherUserId)
        }
      },
      update: {
        default_timer_type: timerType,
        default_duration_seconds: duration || null
      },
      create: {
        user1_id: Math.min(userId, otherUserId),
        user2_id: Math.max(userId, otherUserId),
        default_timer_type: timerType,
        default_duration_seconds: duration || null
      }
    });

    logger.info(`Timer settings updated for conversation between ${userId} and ${otherUserId}`);

    res.json({
      success: true,
      timerSettings: {
        defaultTimerType: timerSettings.default_timer_type,
        defaultDuration: timerSettings.default_duration_seconds
      }
    });
  } catch (error) {
    logger.error('Set message timer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set timer'
    });
  }
};

// GET /api/messages/unread/count - Get total unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const unreadCount = await prisma.messages.count({
      where: {
        receiver_id: userId,
        is_read: false
      }
    });

    res.json({
      success: true,
      unreadCount: unreadCount
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
};

module.exports = exports;
