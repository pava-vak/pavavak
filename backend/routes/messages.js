const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isAuthenticated } = require('../middleware/auth');

// Send message
router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { receiverId, content, timerType } = req.body;
    const senderId = req.user.user_id;

    // Check if connection exists
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: senderId, user2_id: receiverId, status: 'active' },
          { user1_id: receiverId, user2_id: senderId, status: 'active' }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ success: false, error: 'Not connected to this user' });
    }

    // Create message
    const message = await prisma.messages.create({
      data: {
        sender_id: senderId,
        receiver_id: receiverId,
        content: content,
        is_read: false
      }
    });

    console.log('Message sent:', message.message_id);

    // Emit Socket.io event ONLY to receiver (sender already has it via HTTP response)
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('new_message', {
        messageId: message.message_id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        content: message.content,
        sentAt: message.sent_at,
        isRead: message.is_read
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
        isRead: message.is_read
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Get conversation with a user
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.user.user_id;
    const otherUserId = parseInt(req.params.userId);

    // Check connection
    const connection = await prisma.connections.findFirst({
      where: {
        OR: [
          { user1_id: currentUserId, user2_id: otherUserId, status: 'active' },
          { user1_id: otherUserId, user2_id: currentUserId, status: 'active' }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ success: false, error: 'Not connected to this user' });
    }

    // Get messages
    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: currentUserId, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: currentUserId }
        ]
      },
      orderBy: {
        sent_at: 'asc'
      }
    });

    const formattedMessages = messages.map(msg => ({
      messageId: msg.message_id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      content: msg.content,
      sentAt: msg.sent_at,
      isRead: msg.is_read,
      readAt: msg.read_at
    }));

    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
  }
});

// Get all conversations list
router.get('/conversations/list', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get all active connections
    const connections = await prisma.connections.findMany({
      where: {
        OR: [
          { user1_id: userId, status: 'active' },
          { user2_id: userId, status: 'active' }
        ]
      },
      include: {
        user1: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        },
        user2: {
          select: {
            user_id: true,
            username: true,
            full_name: true
          }
        }
      }
    });

    // Get last message and unread count for each conversation
    const conversations = await Promise.all(
      connections.map(async (conn) => {
        const otherUser = conn.user1_id === userId ? conn.user2 : conn.user1;

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
          unreadCount
        };
      })
    );

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

// Mark message as read
router.put('/:messageId/read', isAuthenticated, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;

    const message = await prisma.messages.findUnique({
      where: { message_id: messageId }
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (message.receiver_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.messages.update({
      where: { message_id: messageId },
      data: { is_read: true, read_at: new Date() }
    });

    // Emit Socket.io event ONLY to sender for read receipt
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.sender_id}`).emit('message_read', {
        messageId: messageId,
        readAt: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.user_id;

    const message = await prisma.messages.findUnique({
      where: { message_id: messageId }
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (message.sender_id !== userId && message.receiver_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.messages.delete({
      where: { message_id: messageId }
    });

    console.log(`Message ${messageId} deleted by user ${userId}`);
    
    // Emit Socket.io event to both sender and receiver
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.sender_id}`).emit('message_deleted', {
        messageId: messageId
      });
      io.to(`user_${message.receiver_id}`).emit('message_deleted', {
        messageId: messageId
      });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

module.exports = router;