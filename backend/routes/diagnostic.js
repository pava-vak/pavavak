const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/diagnostic - No auth required
router.get('/', async (req, res) => {
    const result = {
        server: 'online',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        database: 'unknown',
        canRead: false,
        adminExists: false,
        userCount: null,
        error: null
    };

    try {
        // Test database connection
        const users = await prisma.users.findMany({ take: 1 });
        result.database = 'connected';
        result.canRead = true;

        // Check if admin exists
        const admin = await prisma.users.findFirst({
            where: { is_admin: true }
        });
        result.adminExists = !!admin;

        // Get user count
        const count = await prisma.users.count();
        result.userCount = count;

    } catch (err) {
        result.database = 'failed';
        result.error = err.message;
    }

    res.json(result);
});

module.exports = router;