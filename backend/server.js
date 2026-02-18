// PaVa-Vak Main Server
// Complete Express + Socket.io server with all features

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
const { PrismaClient } = require('@prisma/client');
const pgSession = require('connect-pg-simple')(session);

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.DOMAIN || 'http://localhost:3000',
    credentials: true
  },
  pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 25000,
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT) || 60000
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
if (process.env.ENABLE_CORS === 'true') {
  app.use(cors({
    origin: process.env.DOMAIN,
    credentials: true
  }));
} else {
  // Always allow the Render domain in production
  app.use(cors({
    origin: process.env.DOMAIN || 'https://pavavak-backend.onrender.com',
    credentials: true
  }));
}

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Session configuration - stored in PostgreSQL (Supabase)
const sessionMiddleware = session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60 // cleanup every hour
  }),
  secret: process.env.SESSION_SECRET || 'pavavak-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 604800000, // 7 days
    sameSite: 'lax'
  }
});

app.use(sessionMiddleware);

// Passport Configuration
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      const user = await prisma.users.findUnique({
        where: { username: username.toLowerCase() }
      });

      if (!user) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      if (!user.is_approved) {
        return done(null, false, { message: 'Your account is pending approval' });
      }

      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.users.findUnique({
      where: { user_id: id }
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// Make io accessible to routes
app.set('io', io);
app.set('onlineUsers', new Map());

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const connectionRoutes = require('./routes/connections');
const inviteRoutes = require('./routes/invites');
const userRoutes = require('./routes/users');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/diagnostic', require('./routes/diagnostic'));
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// WebSocket connection handling
const onlineUsers = new Map();

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  console.log(`New WebSocket connection: ${socket.id}`);

  const session = socket.request.session;
  const userId = session?.passport?.user;

  if (userId) {
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    socket.join(`user_${userId}`);
    
    console.log(`User ${userId} connected on socket ${socket.id}`);

    socket.broadcast.emit('user_status', {
      userId: userId,
      isOnline: true
    });
  }

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { recipientId, content, timer } = data;
      const senderId = socket.userId;

      if (!senderId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const connection = await prisma.connections.findFirst({
        where: {
          OR: [
            { user1_id: senderId, user2_id: recipientId },
            { user1_id: recipientId, user2_id: senderId }
          ],
          status: 'active'
        }
      });

      if (!connection) {
        socket.emit('error', { message: 'No connection with this user' });
        return;
      }

      const message = await prisma.messages.create({
        data: {
          sender_id: senderId,
          receiver_id: recipientId,
          content,
          sent_at: new Date(),
          is_read: false
        }
      });

      if (timer && timer.type !== 'keep_forever') {
        const timerData = {
          message_id: message.message_id,
          timer_type: timer.type
        };

        if (timer.type === 'timed') {
          timerData.duration_seconds = timer.seconds;
          timerData.expires_at = new Date(Date.now() + timer.seconds * 1000);
        }

        await prisma.message_timers.create({ data: timerData });
      }

      io.to(`user_${recipientId}`).emit('new_message', {
        messageId: message.message_id,
        senderId: senderId,
        receiverId: recipientId,
        content: message.content,
        sentAt: message.sent_at,
        timer: timer || null
      });

      socket.emit('message_sent', {
        messageId: message.message_id,
        sentAt: message.sent_at
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Mark message as read
  socket.on('mark_read', async (data) => {
    try {
      const { messageId } = data;
      const userId = socket.userId;

      const message = await prisma.messages.findFirst({
        where: {
          message_id: messageId,
          receiver_id: userId
        }
      });

      if (message) {
        await prisma.messages.update({
          where: { message_id: messageId },
          data: { 
            is_read: true,
            read_at: new Date()
          }
        });

        io.to(`user_${message.sender_id}`).emit('message_read', {
          messageId: messageId,
          readAt: new Date()
        });
      }
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { recipientId } = data;
    if (recipientId && socket.userId) {
      io.to(`user_${recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: true
      });
    }
  });

  socket.on('stop_typing', (data) => {
    const { recipientId } = data;
    if (recipientId && socket.userId) {
      io.to(`user_${recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: false
      });
    }
  });

  socket.on('disconnect', async () => {
    const userId = socket.userId;
    
    if (userId) {
      onlineUsers.delete(userId);

      socket.broadcast.emit('user_status', {
        userId: userId,
        isOnline: false
      });

      console.log(`User ${userId} disconnected from socket ${socket.id}`);
    }
  });
});

// Background job: Process expired timers
setInterval(async () => {
  try {
    const expiredTimers = await prisma.message_timers.findMany({
      where: {
        expires_at: { 
          lte: new Date(),
          not: null
        }
      },
      include: { messages: true }
    });

    for (const timer of expiredTimers) {
      await prisma.messages.delete({
        where: { message_id: timer.message_id }
      });

      await prisma.message_timers.delete({
        where: { message_id: timer.message_id }
      });

      if (timer.messages) {
        io.to(`user_${timer.messages.receiver_id}`).emit('message_deleted', {
          messageId: timer.message_id
        });
        io.to(`user_${timer.messages.sender_id}`).emit('message_deleted', {
          messageId: timer.message_id
        });
      }
    }

    if (expiredTimers.length > 0) {
      console.log(`Processed ${expiredTimers.length} expired message timers`);
    }
  } catch (error) {
    console.error('Timer processing error:', error);
  }
}, 60000);

// SPA fallback (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  console.log('Database disconnected');
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║                                       ║
║     PaVa-Vak Server Started! 🚀      ║
║                                       ║
║  Port: ${PORT}                          ║
║  Environment: ${process.env.NODE_ENV || 'development'}           ║
║  Domain: ${process.env.DOMAIN || 'http://localhost:3000'}
║                                       ║
╚═══════════════════════════════════════╝
  `);
});

module.exports = { app, server, io, prisma };