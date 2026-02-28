// ============================================================
// backend/routes/diagnostic.js
// Endpoints:
//   GET  /api/diagnostic/status  — server health (public)
//   GET  /api/diagnostic/logs    — recent PM2 logs (admin only)
//   POST /api/diagnostic/restart — restart server (secret key)
// ============================================================

const express        = require('express');
const router         = express.Router();
const prisma         = require('../lib/prisma');
const { execSync }   = require('child_process');
const { exec }       = require('child_process');
const fs             = require('fs');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// ── GET /api/diagnostic/status ─────────────────────────────
// Public — returns server health info
// Protected by RESTART_SECRET so random people can't see it
router.get('/status', async (req, res) => {
    const key = req.query.key || req.headers['x-diag-key'];
    if (key !== (process.env.RESTART_SECRET || 'pavavak-diag-2026')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const mem     = process.memoryUsage();
    const uptime  = process.uptime();

    let dbStatus  = 'unknown';
    let dbLatency = null;
    try {
        const t0 = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - t0;
        dbStatus  = 'connected';
    } catch (e) {
        dbStatus = 'error: ' + e.message;
    }

    // Disk usage
    let disk = 'unknown';
    try { disk = execSync('df -h / | tail -1 | awk \'{print $3"/"$2" ("$5" used")}\' 2>/dev/null').toString().trim(); } catch {}

    // System memory
    let sysMem = 'unknown';
    try { sysMem = execSync('free -m | grep Mem | awk \'{print $3"MB used / "$2"MB total"}\' 2>/dev/null').toString().trim(); } catch {}

    // PM2 status
    let pm2Status = 'unknown';
    let pm2Restarts = 'unknown';
    try {
        const pm2Out = execSync('pm2 jlist 2>/dev/null').toString();
        const pm2    = JSON.parse(pm2Out);
        const app    = pm2.find(p => p.name === 'pavavak');
        if (app) {
            pm2Status   = app.pm2_env.status;
            pm2Restarts = app.pm2_env.restart_time;
        }
    } catch {}

    const onlineUsers = req.app.get('onlineUsers');

    res.json({
        status:     'online',
        timestamp:  new Date().toISOString(),
        uptime:     {
            seconds: Math.floor(uptime),
            human:   formatUptime(uptime)
        },
        memory: {
            heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024) + 'MB',
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
            rss:       Math.round(mem.rss       / 1024 / 1024) + 'MB',
            external:  Math.round(mem.external  / 1024 / 1024) + 'MB'
        },
        system: {
            memory:   sysMem,
            disk:     disk,
            nodeVersion: process.version,
            platform: process.platform
        },
        database: {
            status:  dbStatus,
            latency: dbLatency !== null ? dbLatency + 'ms' : 'N/A'
        },
        pm2: {
            status:   pm2Status,
            restarts: pm2Restarts
        },
        app: {
            onlineUsers: onlineUsers ? onlineUsers.size : 0,
            env:         process.env.NODE_ENV || 'unknown',
            port:        process.env.PORT || 3000
        }
    });
});

// ── GET /api/diagnostic/logs ────────────────────────────────
// Returns last 50 lines of PM2 error + out logs
router.get('/logs', (req, res) => {
    const key = req.query.key || req.headers['x-diag-key'];
    if (key !== (process.env.RESTART_SECRET || 'pavavak-diag-2026')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let errorLog = '', outLog = '';
    const errorPath = '/home/opc/.pm2/logs/pavavak-error.log';
    const outPath   = '/home/opc/.pm2/logs/pavavak-out.log';

    try {
        errorLog = execSync(`tail -50 ${errorPath} 2>/dev/null`).toString();
    } catch { errorLog = '(no error log)'; }

    try {
        outLog = execSync(`tail -50 ${outPath} 2>/dev/null`).toString();
    } catch { outLog = '(no out log)'; }

    res.json({ errorLog, outLog, timestamp: new Date().toISOString() });
});

// ── POST /api/diagnostic/restart ───────────────────────────
// Restarts the PM2 process — protected by RESTART_SECRET
router.post('/restart', (req, res) => {
    const { key } = req.body;
    const secret  = process.env.RESTART_SECRET || 'pavavak-diag-2026';

    if (!key || key !== secret) {
        return res.status(401).json({ error: 'Wrong key' });
    }

    // Send response first, THEN restart (otherwise response never sends)
    res.json({ success: true, message: 'Restarting in 1 second...' });

    setTimeout(() => {
        exec('pm2 restart pavavak', (err) => {
            if (err) console.error('[DIAG] Restart error:', err.message);
            else     console.log('[DIAG] Restart triggered via diagnostic panel');
        });
    }, 1000);
});

// ── HELPER ──────────────────────────────────────────────────
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

module.exports = router;
