# 🎯 PaVa-Vak - Private Admin-Controlled Chat System

**Version:** 1.0.0  
**Status:** Production Ready  
**License:** MIT

---

## 📁 PROJECT STRUCTURE

```
pavavak/
├── backend/                    # Node.js backend
│   ├── server.js              # Main entry point ⭐
│   ├── package.json           # Dependencies
│   ├── .env.example           # Environment template
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── routes/                # API endpoints
│   │   ├── auth.js           # Authentication routes
│   │   ├── messages.js       # Messaging routes
│   │   ├── admin.js          # Admin routes
│   │   └── connections.js    # Connection management
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # Authentication middleware
│   │   ├── validation.js     # Input validation
│   │   └── rateLimiter.js    # Rate limiting
│   ├── controllers/           # Business logic
│   │   ├── authController.js
│   │   ├── messageController.js
│   │   ├── adminController.js
│   │   └── userController.js
│   ├── utils/                 # Helper functions
│   │   ├── logger.js         # Logging utility
│   │   ├── emailer.js        # Email sender
│   │   ├── twoFactor.js      # 2FA utilities
│   │   └── encryption.js     # Backup encryption
│   └── scripts/               # Utility scripts
│       ├── createAdmin.js    # Create first admin
│       └── cleanup.js        # Database cleanup
│
├── frontend/                   # Web interface
│   ├── index.html             # Landing/login page
│   ├── chat.html              # Chat interface
│   ├── admin.html             # Admin dashboard
│   ├── register.html          # User registration
│   ├── css/
│   │   ├── main.css          # Global styles
│   │   ├── chat.css          # Chat styles
│   │   └── admin.css         # Admin styles
│   ├── js/
│   │   ├── app.js            # Main application logic
│   │   ├── chat.js           # Chat functionality
│   │   ├── admin.js          # Admin panel logic
│   │   └── socket.js         # WebSocket client
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── assets/                # Images, icons
│
├── deployment/                 # Deployment files
│   ├── nginx.conf             # Nginx configuration
│   ├── pm2.config.js          # PM2 configuration
│   ├── oracle-setup.sh        # Oracle Cloud setup script
│   └── backup.sh              # Backup automation
│
├── docs/                       # Documentation
│   ├── API.md                 # API documentation
│   ├── DATABASE.md            # Database schema docs
│   └── SECURITY.md            # Security guide
│
├── DEPLOYMENT_GUIDE.md         # Step-by-step deployment
├── README.md                   # This file
└── LICENSE                     # MIT License
```

---

## ✨ FEATURES

### **✅ User Features:**
- One-on-one text messaging
- Real-time delivery (WebSocket)
- Emoji support
- Message timers (view once, timed, keep forever)
- Read receipts & typing indicators
- Offline message queue (PWA)
- Push notifications
- Dark/Light mode

### **✅ Admin Features:**
- Complete user management
- Approve/reject registrations
- Create/remove connections
- Message moderation (view/delete)
- Invite code generation
- Real-time dashboard
- Comprehensive analytics
- System health monitoring
- Audit logs

### **✅ Security Features:**
- 2FA (Email + Google Authenticator)
- Password hashing (bcrypt)
- HTTPS/TLS encryption
- Session management
- Rate limiting
- CSRF protection
- XSS prevention
- Encrypted backups
- Comprehensive logging

---

## 🚀 QUICK START

### **Prerequisites:**
- Oracle Cloud account (free)
- Gmail account (for 2FA)
- Basic terminal knowledge

### **Deployment:**
1. Read `DEPLOYMENT_GUIDE.md`
2. Follow step-by-step instructions
3. Deploy in 2-3 hours
4. **Cost: $0/month**

---

## 🔧 TECHNOLOGY STACK

### **Backend:**
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js 4.x
- **WebSocket:** Socket.io 4.x
- **Database:** PostgreSQL 15
- **ORM:** Prisma
- **Authentication:** Passport.js + bcrypt
- **2FA:** Speakeasy (TOTP) + Nodemailer

### **Frontend:**
- **Core:** HTML5 + CSS3 + Vanilla JavaScript
- **Styling:** Tailwind CSS
- **PWA:** Workbox
- **Icons:** Lucide Icons

### **Infrastructure:**
- **Hosting:** Oracle Cloud (Free Tier)
- **Web Server:** Nginx
- **Process Manager:** PM2
- **SSL:** Let's Encrypt (Certbot)
- **Domain:** DuckDNS (free)

---

## 📊 DATABASE SCHEMA

### **Core Tables:**
1. **users** - User accounts & authentication
2. **invite_codes** - Registration codes (24hr expiry)
3. **connections** - Who can chat with whom
4. **messages** - All chat messages
5. **message_timers** - Auto-delete timers
6. **conversation_timer_settings** - Default timers
7. **sessions** - User sessions
8. **admin_logs** - Admin action audit trail
9. **system_logs** - System events
10. **login_attempts** - Security monitoring

See `docs/DATABASE.md` for full schema.

---

## 🔐 SECURITY

### **What's Protected:**
✅ Passwords (bcrypt hashed, never plain text)  
✅ Sessions (HTTP-only, secure cookies)  
✅ Data in transit (HTTPS/TLS 1.3)  
✅ Backups (AES-256 encrypted)  
✅ API endpoints (authentication required)  
✅ Inputs (validated & sanitized)  

### **What's Logged:**
✅ All user actions  
✅ All admin actions  
✅ Login attempts (success/failure)  
✅ System events  
✅ Errors & warnings  

---

## 📈 PERFORMANCE

- **Message Delivery:** <100ms (WebSocket)
- **Page Load:** <1 second
- **Concurrent Users:** 100+ supported
- **Database:** Optimized for 1M+ messages
- **Uptime Target:** 99.5%

---

## 🔄 VERSION ROADMAP

### **Version 1.0 (Current):**
- ✅ One-on-one messaging
- ✅ Admin-controlled connections
- ✅ Message timers
- ✅ 2FA
- ✅ PWA
- ✅ Encrypted backups

### **Version 2.0 (Planned):**
- Group chats
- File sharing (images, documents)
- Voice messages
- Edit/forward messages
- End-to-end encryption
- Native Android/iOS apps

---

## 🆘 SUPPORT & TROUBLESHOOTING

### **Common Issues:**

**App won't start:**
```bash
pm2 logs pavavak --err
# Check error logs
```

**Database connection failed:**
```bash
sudo systemctl status postgresql
# Ensure PostgreSQL is running
```

**Nginx errors:**
```bash
sudo nginx -t
# Test configuration
```

See `DEPLOYMENT_GUIDE.md` for full troubleshooting.

---

## 📝 LICENSE

MIT License - See LICENSE file

You are free to:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Sublicense

---

## 🙏 ACKNOWLEDGMENTS

Built with:
- Node.js & Express.js
- Socket.io (real-time)
- PostgreSQL & Prisma
- Tailwind CSS
- Oracle Cloud (free hosting)

---

## 📞 CONTACT

For questions or support:
- Check `DEPLOYMENT_GUIDE.md`
- Review `docs/` folder
- Check GitHub issues

---

**🚀 Ready to deploy? Start with `DEPLOYMENT_GUIDE.md`!**

**Total Cost:** $0/month  
**Your Data:** 100% Private  
**Your Control:** Complete  

---

**Made with ❤️ for privacy-conscious users**
