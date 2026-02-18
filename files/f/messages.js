const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validation');
const { encryptMessage, decryptMessage } = require('../utils/encryption');
const logger = require('../utils/logger');

// Send message
router.post('/send', authenticate, validateMessage, async (req, res) => {
  try {
    const { recipientId, content, timer } = req.body;
    const senderId = req.user.userId;

    // Check if connection exists
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: senderId, friendId: recipientId, status: 'APPROVED' },
          { userId: recipientId, friendId: senderId, status: 'APPROVED' }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ error: 'Not connected to this user' });
    }

    // Encrypt message
    const encryptedContent = encryptMessage(content);

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId,
        recipientId,
        content: encryptedContent,
        isEncrypted: true
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Create message timer if specified
    if (timer && timer > 0) {
      await prisma.messageTimer.create({
        data: {
          messageId: message.id,
          expiresAt: new Date(Date.now() + timer * 1000)
        }
      });
    }

    logger.info(`Message sent from ${senderId} to ${recipientId}`);

    // Return decrypted message to sender
    res.json({
      ...message,
      content: content // Send back unencrypted to sender
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get conversation with a user
router.get('/conversation/:userId', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);

    // Check connection
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: otherUserId, status: 'APPROVED' },
          { userId: otherUserId, friendId: currentUserId, status: 'APPROVED' }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ error: 'Not connected to this user' });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: currentUserId }
        ],
        deletedAt: null
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        },
        recipient: {
          select: {
            id: true,
            username: true
          }
        },
        timer: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Decrypt messages
    const decryptedMessages = messages.map(msg => ({
      ...msg,
      content: msg.isEncrypted ? decryptMessage(msg.content) : msg.content
    }));

    res.json(decryptedMessages);
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get all conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all approved connections
    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { userId: userId, status: 'APPROVED' },
          { friendId: userId, status: 'APPROVED' }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Get last message for each conversation
    const conversations = await Promise.all(
      connections.map(async (conn) => {
        const otherUser = conn.userId === userId ? conn.friend : conn.user;

        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: otherUser.id },
              { senderId: otherUser.id, recipientId: userId }
            ],
            deletedAt: null
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherUser.id,
            recipientId: userId,
            readAt: null,
            deletedAt: null
          }
        });

        return {
          user: otherUser,
          lastMessage: lastMessage ? {
            ...lastMessage,
            content: lastMessage.isEncrypted ? decryptMessage(lastMessage.content) : lastMessage.content
          } : null,
          unreadCount
        };
      })
    );

    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Mark message as read
router.put('/:messageId/read', authenticate, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.userId;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.recipientId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() }
    });

    res.json(updatedMessage);
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete('/:messageId', authenticate, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user.userId;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId && message.recipientId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Soft delete
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() }
    });

    logger.info(`Message ${messageId} deleted by user ${userId}`);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Set conversation timer
router.post('/timer/:userId', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);
    const { timer } = req.body;

    if (!timer || timer < 0) {
      return res.status(400).json({ error: 'Invalid timer value' });
    }

    // Check connection
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: otherUserId, status: 'APPROVED' },
          { userId: otherUserId, friendId: currentUserId, status: 'APPROVED' }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ error: 'Not connected to this user' });
    }

    // Create or update timer setting
    const timerSetting = await prisma.conversationTimerSetting.upsert({
      where: {
        connectionId: connection.id
      },
      update: {
        timerSeconds: timer
      },
      create: {
        connectionId: connection.id,
        timerSeconds: timer
      }
    });

    res.json(timerSetting);
  } catch (error) {
    logger.error('Error setting conversation timer:', error);
    res.status(500).json({ error: 'Failed to set timer' });
  }
});

module.exports = router;
