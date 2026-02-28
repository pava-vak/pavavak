// ============================================================
// backend/lib/prisma.js  — SINGLETON Prisma Client
//
// WHY THIS EXISTS:
//   Every route file that did `new PrismaClient()` created its
//   own connection pool (default 10 connections each).
//   With 7 route files = up to 70 DB connections attempted.
//   Supabase free tier allows only 20 — causing pool exhaustion,
//   hanging queries, and server crashes requiring manual reboot.
//
//   This singleton ensures the ENTIRE app shares ONE client
//   with ONE controlled pool = stable, no more crashes.
// ============================================================

const { PrismaClient } = require('@prisma/client');

// Limit pool to 5 connections — well within Supabase free tier (20 max)
// Leaves headroom for: pgSession (2), admin queries, future routes
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

// Verify connection on startup
prisma.$connect()
    .then(() => console.log('✅ Prisma connected (shared singleton, pool=5)'))
    .catch(err => console.error('❌ Prisma connect failed:', err.message));

module.exports = prisma;