#!/usr/bin/env node
// Cleanup Script for PaVa-Vak
// Removes expired sessions, invite codes, message timers, etc.
// Usage: node scripts/cleanup.js
// Or schedule with cron: 0 2 * * * /usr/bin/node /path/to/scripts/cleanup.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
  console.log('\n========================================');
  console.log('   PaVa-Vak Cleanup Script');
  console.log(`   ${new Date().toISOString()}`);
  console.log('========================================\n');

  let totalCleaned = 0;

  try {
    // 1. Clean expired sessions
    console.log('🧹 Cleaning expired sessions...');
    const expiredSessions = await prisma.sessions.deleteMany({
      where: {
        expires_at: {
          lt: new Date()
        }
      }
    });
    console.log(`   ✓ Removed ${expiredSessions.count} expired session(s)`);
    totalCleaned += expiredSessions.count;

    // 2. Clean expired invite codes (older than 24 hours and not used)
    console.log('\n🧹 Cleaning expired invite codes...');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredInvites = await prisma.invite_codes.deleteMany({
      where: {
        used: false,
        created_at: {
          lt: oneDayAgo
        }
      }
    });
    console.log(`   ✓ Removed ${expiredInvites.count} expired invite code(s)`);
    totalCleaned += expiredInvites.count;

    // 3. Clean expired message timers and delete messages
    console.log('\n🧹 Cleaning expired messages with timers...');
    
    // Get expired message timers
    const expiredTimers = await prisma.message_timers.findMany({
      where: {
        expires_at: {
          lt: new Date(),
          not: null
        }
      },
      select: {
        message_id: true
      }
    });

    if (expiredTimers.length > 0) {
      const messageIds = expiredTimers.map(t => t.message_id);
      
      // Delete timers first
      await prisma.message_timers.deleteMany({
        where: {
          message_id: {
            in: messageIds
          }
        }
      });

      // Delete messages
      const deletedMessages = await prisma.messages.deleteMany({
        where: {
          message_id: {
            in: messageIds
          }
        }
      });

      console.log(`   ✓ Removed ${deletedMessages.count} expired message(s)`);
      totalCleaned += deletedMessages.count;
    } else {
      console.log(`   ✓ No expired messages found`);
    }

    // 4. Clean old login attempts (keep last 30 days)
    console.log('\n🧹 Cleaning old login attempts...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldLoginAttempts = await prisma.login_attempts.deleteMany({
      where: {
        attempted_at: {
          lt: thirtyDaysAgo
        }
      }
    });
    console.log(`   ✓ Removed ${oldLoginAttempts.count} old login attempt(s)`);
    totalCleaned += oldLoginAttempts.count;

    // 5. Clean old system logs (keep last 60 days)
    console.log('\n🧹 Cleaning old system logs...');
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oldSystemLogs = await prisma.system_logs.deleteMany({
      where: {
        logged_at: {
          lt: sixtyDaysAgo
        }
      }
    });
    console.log(`   ✓ Removed ${oldSystemLogs.count} old system log(s)`);
    totalCleaned += oldSystemLogs.count;

    // 6. Clean old admin logs (keep last 90 days)
    console.log('\n🧹 Cleaning old admin logs...');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oldAdminLogs = await prisma.admin_logs.deleteMany({
      where: {
        performed_at: {
          lt: ninetyDaysAgo
        }
      }
    });
    console.log(`   ✓ Removed ${oldAdminLogs.count} old admin log(s)`);
    totalCleaned += oldAdminLogs.count;

    // 7. Clean orphaned message timers (messages that don't exist)
    console.log('\n🧹 Cleaning orphaned message timers...');
    const allTimers = await prisma.message_timers.findMany({
      select: {
        message_id: true
      }
    });

    let orphanedCount = 0;
    for (const timer of allTimers) {
      const messageExists = await prisma.messages.findUnique({
        where: { message_id: timer.message_id }
      });

      if (!messageExists) {
        await prisma.message_timers.delete({
          where: { message_id: timer.message_id }
        });
        orphanedCount++;
      }
    }
    console.log(`   ✓ Removed ${orphanedCount} orphaned timer(s)`);
    totalCleaned += orphanedCount;

    // 8. Media assets maintenance (safe: orphan cleanup + storage report)
    console.log('\n?? Checking media assets...');
    try {
      const mediaStats = await prisma.media_assets.aggregate({
        _count: { media_id: true },
        _sum: { byte_size: true }
      });
      const mediaCount = mediaStats._count.media_id || 0;
      const mediaBytes = mediaStats._sum.byte_size || 0;
      console.log(`   ? Media assets: ${mediaCount} file(s), ${(mediaBytes / (1024 * 1024)).toFixed(2)} MB`);

      // Orphan cleanup (should usually be zero because FK is CASCADE)
      const orphanedMedia = await prisma.$queryRaw`
        SELECT m.media_id
        FROM media_assets m
        LEFT JOIN messages msg ON msg.message_id = m.message_id
        WHERE msg.message_id IS NULL
      `;
      const orphanIds = Array.isArray(orphanedMedia)
        ? orphanedMedia.map(r => Number(r.media_id)).filter(Boolean)
        : [];

      if (orphanIds.length > 0) {
        const removed = await prisma.media_assets.deleteMany({
          where: { media_id: { in: orphanIds } }
        });
        console.log(`   ? Removed ${removed.count} orphaned media asset(s)`);
        totalCleaned += removed.count;
      } else {
        console.log('   ? No orphaned media assets');
      }
    } catch (mediaError) {
      console.log(`   ??  Media maintenance skipped: ${mediaError.message}`);
    }

    // Summary
    console.log('\n========================================');
    console.log(`✅ Cleanup completed successfully!`);
    console.log(`   Total items cleaned: ${totalCleaned}`);
    console.log('========================================\n');

    // Log cleanup to system logs
    await prisma.system_logs.create({
      data: {
        event_type: 'CLEANUP',
        details: `Cleanup completed. ${totalCleaned} items removed.`,
        logged_at: new Date()
      }
    });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('\nDetails:', error);

    // Log error to system logs
    try {
      await prisma.system_logs.create({
        data: {
          event_type: 'CLEANUP_ERROR',
          details: `Cleanup failed: ${error.message}`,
          logged_at: new Date()
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', async () => {
  console.log('\n\nCleanup interrupted by user\n');
  await prisma.$disconnect();
  process.exit(0);
});

// Run cleanup
cleanup();

