const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all connections
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { userId: userId },
          { friendId: userId }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        },
        friend: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format connections
    const formattedConnections = connections.map(conn => {
      const isInitiator = conn.userId === userId;
      const otherUser = isInitiator ? conn.friend : conn.user;

      return {
        id: conn.id,
        user: otherUser,
        status: conn.status,
        isInitiator,
        createdAt: conn.createdAt,
        approvedAt: conn.approvedAt
      };
    });

    res.json(formattedConnections);
  } catch (error) {
    logger.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Get pending connection requests
router.get('/pending', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const pendingRequests = await prisma.connection.findMany({
      where: {
        friendId: userId,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(pendingRequests);
  } catch (error) {
    logger.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Send connection request (using invite code)
router.post('/request', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.userId;

    if (!code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Find invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: code }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    if (invite.usedAt) {
      return res.status(400).json({ error: 'Invite code already used' });
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite code expired' });
    }

    if (invite.createdBy === userId) {
      return res.status(400).json({ error: 'Cannot use your own invite code' });
    }

    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: invite.createdBy },
          { userId: invite.createdBy, friendId: userId }
        ]
      }
    });

    if (existingConnection) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    // Create connection request
    const connection = await prisma.connection.create({
      data: {
        userId: userId,
        friendId: invite.createdBy,
        status: 'PENDING'
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Mark invite as used
    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        usedBy: userId
      }
    });

    logger.info(`Connection request sent from ${userId} to ${invite.createdBy}`);
    res.json(connection);
  } catch (error) {
    logger.error('Error sending connection request:', error);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// Approve connection request
router.put('/:connectionId/approve', authenticate, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const userId = req.user.userId;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.friendId !== userId) {
      return res.status(403).json({ error: 'Not authorized to approve this connection' });
    }

    if (connection.status !== 'PENDING') {
      return res.status(400).json({ error: 'Connection is not pending' });
    }

    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    logger.info(`Connection ${connectionId} approved by user ${userId}`);
    res.json(updatedConnection);
  } catch (error) {
    logger.error('Error approving connection:', error);
    res.status(500).json({ error: 'Failed to approve connection' });
  }
});

// Reject connection request
router.put('/:connectionId/reject', authenticate, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const userId = req.user.userId;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.friendId !== userId) {
      return res.status(403).json({ error: 'Not authorized to reject this connection' });
    }

    if (connection.status !== 'PENDING') {
      return res.status(400).json({ error: 'Connection is not pending' });
    }

    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'REJECTED'
      }
    });

    logger.info(`Connection ${connectionId} rejected by user ${userId}`);
    res.json(updatedConnection);
  } catch (error) {
    logger.error('Error rejecting connection:', error);
    res.status(500).json({ error: 'Failed to reject connection' });
  }
});

// Remove connection
router.delete('/:connectionId', authenticate, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const userId = req.user.userId;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.userId !== userId && connection.friendId !== userId) {
      return res.status(403).json({ error: 'Not authorized to remove this connection' });
    }

    await prisma.connection.delete({
      where: { id: connectionId }
    });

    logger.info(`Connection ${connectionId} removed by user ${userId}`);
    res.json({ message: 'Connection removed successfully' });
  } catch (error) {
    logger.error('Error removing connection:', error);
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

// Block user
router.post('/:connectionId/block', authenticate, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const userId = req.user.userId;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.userId !== userId && connection.friendId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'BLOCKED'
      }
    });

    logger.info(`Connection ${connectionId} blocked by user ${userId}`);
    res.json(updatedConnection);
  } catch (error) {
    logger.error('Error blocking connection:', error);
    res.status(500).json({ error: 'Failed to block connection' });
  }
});

module.exports = router;
