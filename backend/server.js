// =====================================================
// PaVa-Vak Main Server — Production Ready v2.0
// Oracle Cloud | Socket.io | PWA | Push Notifications
// =====================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const pgSession = require('connect-pg-simple')(session);
const prisma     = require('./lib/prisma'); // shared singleton - one pool for entire app
const { ensurePresenceTypingSchema } = require('./lib/presenceTypingBootstrap');
const { ensurePasswordResetSchema } = require('./lib/passwordResetBootstrap');
const { ensureProfilePrivacySchema } = require('./lib/profilePrivacyBootstrap');

// =====================
// INIT
// =====================

const app = express();
const server = http.createServer(app);

// =====================
// SOCKET.IO (Future-Ready)
// =====================
const io = socketIo(server, {
  cors: {
    origin: process.env.DOMAIN || '*',
    credentials: true
  },
  pingInterval: Number(process.env.WS_PING_INTERVAL) || 25000,
  pingTimeout: Number(process.env.WS_PING_TIMEOUT) || 60000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  maxHttpBufferSize: 1e6,
  connectTimeout: 45000,
});

// =====================
// MIDDLEWARE
// =====================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: process.env.DOMAIN || '*',
  credentials: true
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// =====================
// CACHE CONTROL
// Prevents browser and SW caching HTML pages and API responses.
// Fixes redirect loops caused by stale cached session responses.
// CSS/JS/images are still cached by the SW for performance.
// Works correctly on both localhost and Oracle Cloud.
// =====================
app.use((req, res, next) => {
  // Never cache API responses — always fetch fresh session/data
  if (req.path.startsWith('/api/')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    });
  }
  // Never cache HTML pages — prevents stale page redirects
  if (req.path.endsWith('.html') || req.path === '/' || req.path === '') {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
  }
  next();
});

// =====================
// SESSION (PostgreSQL)
// =====================
const sessionMiddleware = session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60,
    ttl: 7 * 24 * 60 * 60,
    errorLog: console.error
  }),
  secret: process.env.SESSION_SECRET || 'pavavak-secret-change-this',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: false,                // set true only after HTTPS is active
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);

// =====================
// PASSPORT
// =====================
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await prisma.users.findUnique({
        where: { username: username.toLowerCase() }
      });
      if (!user || !user.is_approved) return done(null, false);
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.user_id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.users.findUnique({ where: { user_id: id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// =====================
// ROUTES
// =====================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
// Legacy connections route is intentionally not mounted.
// Current app/admin flows use /api/admin/connections and /api/messages/admin/connections/all.
// The old /api/connections implementation is schema-incompatible and would fail if called.
app.use('/api/invites', require('./routes/invites'));
app.use('/api/users', require('./routes/users'));
app.use('/api/diagnostic', require('./routes/diagnostic'));
app.use('/api/mobile', require('./routes/mobile'));
app.use('/api/presence', require('./routes/presence'));
app.use('/api/typing', require('./routes/typing'));

// =====================
// PUSH NOTIFICATIONS (Web Push / PWA)
// =====================
let webpush = null;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@pavavak.com'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('✅ Push notifications enabled');
  } else {
    console.log('⚠️  Push notifications: VAPID keys not set (optional)');
    webpush = null;
  }
} catch (e) {
  console.log('ℹ️  web-push not installed — push notifications disabled (optional)');
}

app.set('webpush', webpush);

app.post('/api/push/subscribe', (req, res) => {
  if (!webpush) return res.status(503).json({ error: 'Push not enabled' });
  const subscription = req.body;
  app.get('pushSubscriptions')?.set(req.user?.user_id, subscription);
  res.json({ success: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  app.get('pushSubscriptions')?.delete(req.user?.user_id);
  res.json({ success: true });
});

app.get('/api/push/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.json({ key: null });
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// =====================
// PWA MANIFEST (Dynamic)
// =====================
app.get('/manifest.json', (req, res) => {
  res.json({
    id: '/',
    name: process.env.APP_NAME || 'PaVa-Vak',
    short_name: process.env.APP_SHORT_NAME || 'PaVa-Vak',
    description: 'Private messaging app',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#0f1419',
    theme_color: process.env.APP_THEME_COLOR || '#4f46e5',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    screenshots: [
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'PaVa-Vak Chat'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'wide',
        label: 'PaVa-Vak Chat'
      }
    ],
    categories: ['social', 'communication'],
    shortcuts: [
      {
        name: 'Open Chat',
        url: '/chat.html',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
      }
    ]
  });
});

// =====================
// HEALTH CHECK (Enhanced)
// =====================
app.get('/api/health', async (req, res) => {
  const memUsage = process.memoryUsage();
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error';
  }
  res.json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    },
    db: dbStatus,
    onlineUsers: onlineUsers.size,
    pushEnabled: !!webpush
  });
});

// =====================
// STATIC FRONTEND
// etag: false — prevents 304 Not Modified responses that cause
//               stale session data to be served from browser cache
// maxAge: 0   — HTML files never cached; SW handles CSS/JS caching
// =====================
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: 0,
  etag: false,
  lastModified: false,
}));

// =====================
// SOCKET.IO — SHARED STATE
// =====================
const onlineUsers = new Map();
const pushSubscriptions = new Map();

app.set('onlineUsers', onlineUsers);
app.set('io', io);
app.set('pushSubscriptions', pushSubscriptions);

// =====================
// SOCKET AUTH + REAL-TIME
// =====================
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const userId = socket.request.session?.passport?.user;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.userId = userId;
  onlineUsers.set(userId, socket.id);
  socket.join(`user_${userId}`);
  prisma.$executeRaw`
    INSERT INTO user_presence (user_id, is_online, last_heartbeat_at, updated_at)
    VALUES (${userId}, true, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      is_online = true,
      last_heartbeat_at = NOW(),
      updated_at = NOW()
  `.catch(() => {});

  io.emit('user_status', { userId, status: 'online' });

  // ── Delivered receipts on connect ──────────────────────────
  // When user connects, find all unread messages sent TO them
  // and emit message_delivered to each sender so their tick
  // upgrades from ✓ (sent) to ✓✓ grey (delivered)
  (async () => {
    try {
      const undeliveredMessages = await prisma.messages.findMany({
        where: {
          receiver_id: userId,
          delivered_at: null
        },
        select: {
          message_id: true,
          sender_id: true
        }
      });
      if (undeliveredMessages.length > 0) {
        await prisma.messages.updateMany({
          where: { message_id: { in: undeliveredMessages.map((m) => m.message_id) } },
          data: { delivered_at: new Date() }
        });
      }
      undeliveredMessages.forEach(msg => {
        io.to(`user_${msg.sender_id}`).emit('message_delivered', {
          messageId: msg.message_id,
          deliveredAt: new Date()
        });
      });
    } catch (e) {
      console.error('[Socket] Delivered receipts error:', e.message);
    }
  })();

  socket.on('typing', ({ recipientId }) => {
    if (recipientId) {
      io.to(`user_${recipientId}`).emit('user_typing', { userId, isTyping: true });
    }
  });

  socket.on('stop_typing', ({ recipientId }) => {
    if (recipientId) {
      io.to(`user_${recipientId}`).emit('user_typing', { userId, isTyping: false });
    }
  });

  socket.on('message_received', async ({ messageId }) => {
    const numericMessageId = Number.parseInt(messageId, 10);
    if (!Number.isFinite(numericMessageId) || numericMessageId <= 0) return;
    try {
      const message = await prisma.messages.findUnique({
        where: { message_id: numericMessageId },
        select: {
          message_id: true,
          sender_id: true,
          receiver_id: true,
          delivered_at: true
        }
      });
      if (!message || message.receiver_id !== userId) return;

      const deliveredAt = message.delivered_at || new Date();
      if (!message.delivered_at) {
        await prisma.messages.update({
          where: { message_id: numericMessageId },
          data: { delivered_at: deliveredAt }
        });
      }

      io.to(`user_${message.sender_id}`).emit('message_delivered', {
        messageId: message.message_id,
        deliveredAt
      });
    } catch (e) {
      console.error('[Socket] message_received ack failed:', e.message);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    prisma.$executeRaw`
      INSERT INTO user_presence (user_id, is_online, last_seen_at, last_heartbeat_at, updated_at)
      VALUES (${userId}, false, NOW(), NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_online = false,
        last_seen_at = NOW(),
        updated_at = NOW()
    `.catch(() => {});
    io.emit('user_status', { userId, status: 'offline' });
  });

  socket.on('reconnect', () => {
    onlineUsers.set(userId, socket.id);
    socket.join(`user_${userId}`);
    io.emit('user_status', { userId, status: 'online' });
  });
});

// =====================
// SPA FALLBACK
// =====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message
  });
});

// =====================
// UNCAUGHT EXCEPTION GUARD
// =====================
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// =====================
// GRACEFUL SHUTDOWN
// =====================
const shutdown = async (signal) => {
  console.log(`\n[${signal}] Graceful shutdown started...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
    } catch (e) {
      console.error('DB disconnect error:', e);
    }
    console.log('✅ Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('⚠️  Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// =====================
// MEMORY WATCHDOG
// =====================
setInterval(() => {
  const used = process.memoryUsage().rss / 1024 / 1024;
  if (used > 400) {
    console.warn(`⚠️  High memory usage: ${Math.round(used)}MB`);
  }
}, 60 * 1000);

// =====================
// DB KEEPALIVE
// =====================
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error('[DB KEEPALIVE] Failed:', e.message);
  }
}, 4 * 60 * 1000);

// =====================
// TYPING STATUS CLEANUP
// =====================
setInterval(async () => {
  try {
    await prisma.$executeRaw`
      UPDATE typing_status
      SET is_typing = false, updated_at = NOW()
      WHERE is_typing = true AND expires_at <= NOW()
    `;
  } catch (e) {
    console.error('[TYPING CLEANUP] Failed:', e.message);
  }
}, 30 * 1000);

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await ensurePresenceTypingSchema();
    console.log('[BOOT] Presence/typing schema ensured');
  } catch (e) {
    console.error('[BOOT] Presence/typing schema bootstrap failed:', e.message);
    // Keep existing app startup unaffected even if bootstrap fails.
  }
  try {
    await ensurePasswordResetSchema();
    console.log('[BOOT] Password reset schema ensured');
  } catch (e) {
    console.error('[BOOT] Password reset schema bootstrap failed:', e.message);
    // Keep existing app startup unaffected even if bootstrap fails.
  }
  try {
    await ensureProfilePrivacySchema();
    console.log('[BOOT] Profile/privacy schema ensured');
  } catch (e) {
    console.error('[BOOT] Profile/privacy schema bootstrap failed:', e.message);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║     PaVa-Vak Server v2.0 Started 🚀       ║
║                                           ║
║  Port        : ${PORT}                       
║  Environment : ${process.env.NODE_ENV || 'development'}             
║  Push Notif  : ${webpush ? 'Enabled ✅' : 'Disabled ⚠️ '}          
║  DB Keepalive: Enabled ✅                  
║  Memory Guard: Enabled ✅                  
║                                           ║
╚═══════════════════════════════════════════╝
`);
  });
}

startServer();

module.exports = { app, server, io, prisma };


