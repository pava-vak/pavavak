// ============================================================
// ecosystem.config.js — PM2 Process Manager Config
// Place at: /home/opc/PaVa-Vak/ecosystem.config.js
//
// Deploy:  pm2 start ecosystem.config.js
// Reload:  pm2 reload pavavak (zero-downtime)
// Restart: pm2 restart pavavak
// Logs:    pm2 logs pavavak
// Monitor: pm2 monit
// ============================================================

module.exports = {
    apps: [{
        name: 'pavavak',
        script: './backend/server.js',
        cwd: '/home/opc/PaVa-Vak',

        // ── Instances ──────────────────────────────────────
        instances: 1,           // single instance (Supabase connection limit)
        exec_mode: 'fork',      // NOT cluster — cluster multiplies DB connections

        // ── Auto-restart policy ────────────────────────────
        autorestart: true,
        watch: false,           // never watch files in production (causes restart loops)
        max_restarts: 10,       // restart up to 10 times before giving up
        restart_delay: 5000,    // wait 5s between restarts (not a tight loop)
        min_uptime: '10s',      // must stay up 10s to count as a successful start

        // ── Memory limit ───────────────────────────────────
        // Oracle free tier: 1GB RAM
        // If Node exceeds 350MB it has likely leaked — restart it
        max_memory_restart: '350M',

        // ── Environment ────────────────────────────────────
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },

        // ── Logging ────────────────────────────────────────
        // Logs rotate daily, keep 7 days, max 10MB per file
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: '/home/opc/PaVa-Vak/logs/error.log',
        out_file:   '/home/opc/PaVa-Vak/logs/out.log',
        merge_logs: true,
        log_type: 'json',

        // ── Crash recovery ─────────────────────────────────
        // If process dies, PM2 restarts it automatically
        // exp_backoff_restart_delay starts at 100ms, doubles each time
        // up to max 16s — prevents hammering a broken DB repeatedly
        exp_backoff_restart_delay: 100,

        // ── Kill timeout ───────────────────────────────────
        kill_timeout: 5000,     // wait 5s for graceful shutdown before force-kill

        // ── Node args ──────────────────────────────────────
        node_args: [
            '--max-old-space-size=300',  // hard cap Node heap at 300MB
        ],
    }]
};