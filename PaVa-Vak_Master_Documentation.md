# 📄 PAVA-VAK MASTER DOCUMENTATION

## पवा-वाक् - Private Admin-Controlled Real-Time Chat System

---

**Project Name:** PaVa-Vak (पवा-वाक्)  
**Meaning:** Speech/Voice (Sanskrit: वाक्)  
**Version:** 1.0 (MVP)  
**Platform:** Progressive Web App (PWA)  
**Hosting:** Oracle Cloud Free VPS  
**Date:** February 11, 2026  
**Status:** ✅ Ready for Implementation

---

## 📋 TABLE OF CONTENTS

1. [Introduction & Objective](#1-introduction--objective)
2. [System Actors & Roles](#2-system-actors--roles)
3. [System Scope & Boundaries](#3-system-scope--boundaries)
4. [High-Level System Flow](#4-high-level-system-flow)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technology Stack](#7-technology-stack)
8. [Database Design](#8-database-design)
9. [Message Timer System](#9-message-timer-system)
10. [Invite Code System](#10-invite-code-system)
11. [User Visibility & Connection Control](#11-user-visibility--connection-control)
12. [Admin Control Panel](#12-admin-control-panel)
13. [Security Model](#13-security-model)
14. [Real-Time Architecture](#14-real-time-architecture)
15. [User Flows](#15-user-flows)
16. [Admin Flows](#16-admin-flows)
17. [PWA Implementation](#17-pwa-implementation)
18. [Oracle Cloud Setup Guide](#18-oracle-cloud-setup-guide)
19. [Deployment Strategy](#19-deployment-strategy)
20. [Version 1 vs Version 2 Roadmap](#20-version-1-vs-version-2-roadmap)
21. [Success Criteria](#21-success-criteria)
22. [Maintenance & Monitoring](#22-maintenance--monitoring)
23. [Troubleshooting Guide](#23-troubleshooting-guide)
24. [Appendix & Resources](#24-appendix--resources)

---

## 1. INTRODUCTION & OBJECTIVE

### 1.1 Purpose

To build a **private, admin-controlled, real-time chat system** where:

✅ Admin has **complete control** over who can see and chat with whom  
✅ Users **cannot discover** other users unless admin explicitly connects them  
✅ Messages are delivered **instantly** (WhatsApp-level speed using WebSocket)  
✅ Users can set **flexible message timers** (view once, timed deletion, keep forever)  
✅ Admin can **monitor all activity** and moderate content  
✅ System is **100% free** to run (Oracle Cloud Free Tier)  
✅ All data stays on **your own server** (complete privacy)  
✅ Access is controlled via **one-time invite codes with 24-hour expiry**  
✅ Designed for **50-100 concurrent users**  
✅ **PWA platform** - works on all devices (Android, iOS, Desktop)

### 1.2 Why This System Exists

**❌ Problem:**
- Existing chat apps (WhatsApp, Telegram, Signal) store data on third-party servers
- No granular control over who can see/chat with whom
- Cannot moderate or access messages for safety
- Privacy concerns with commercial platforms
- Unwanted contact and spam
- No control over message retention

**✅ Solution:**
- **Your own server** - complete data ownership
- **Your own rules** - full control over connections
- **Your own monitoring** - admin can see everything
- **Your own timeline** - flexible message retention
- **Closed friend circle** - no unwanted discovery
- **Free forever** - Oracle Cloud Free Tier

### 1.3 Core Principles

1. **Privacy First** - No third-party access to data
2. **Admin Control** - Every connection requires approval
3. **Speed Matters** - Real-time messaging using WebSockets
4. **User Flexibility** - Customizable message timers
5. **Zero Cost** - Built on free infrastructure
6. **Future-Proof** - Designed for easy feature additions
7. **Simplicity** - Clean, intuitive interface
8. **Reliability** - Automated backups, 99%+ uptime

---

## 2. SYSTEM ACTORS & ROLES

### 2.1 Admin (YOU - Primary Controller)

**Identity:** System owner and ultimate authority

**Capabilities:**
- Generate and manage invite codes (one-time use, 24hr expiry)
- Approve/reject user registrations
- Create connections between users (enable chat)
- Break connections (disable chat)
- View all users and their status
- Read all messages (moderation)
- Delete any message permanently
- Ban/remove users
- Monitor system activity
- Access admin dashboard 24/7
- View analytics and system health

**Restrictions:**
- Cannot bypass security (must use proper authentication)
- Cannot recover permanently deleted messages
- Actions are logged for audit

**Dashboard Access:** `/admin` (requires admin login)

---

### 2.2 Regular User (Friend Circle Members)

**Identity:** Approved member of the chat system

**Capabilities:**
- Sign up using invite code
- Wait for admin approval
- Once approved:
  - See only users admin connected them with
  - Chat with connected users only
  - Send text messages and emojis
  - Set message timers (per-message or per-conversation)
  - Delete messages from their view
  - Customize profile (name, status)
  - Receive real-time messages
  - Get push notifications (PWA)

**Restrictions:**
- ❌ Cannot see all users in system
- ❌ Cannot search for users
- ❌ Cannot create groups (Version 1)
- ❌ Cannot send files/images (Version 1)
- ❌ Cannot permanently delete messages from server
- ❌ Cannot bypass admin's connection controls
- ❌ Cannot generate invite codes
- ❌ Cannot see admin activities

---

### 2.3 Pending User (Awaiting Approval)

**Identity:** Someone who signed up but not yet approved

**Capabilities:**
- See "Waiting for approval" screen
- View their registration status
- Cancel registration

**Restrictions:**
- Cannot access chat system
- Cannot see any users
- Cannot send messages

---

## 3. SYSTEM SCOPE & BOUNDARIES

### 3.1 What the System WILL Do (Version 1)

**✅ User Management:**
- One-time invite code generation with 24-hour expiry
- User registration with approval workflow
- Admin-controlled user connections
- User profile management
- Ban/unban functionality

**✅ Messaging:**
- Real-time text messaging (WebSocket)
- Emoji support (full Unicode)
- Message delivery confirmation
- Read receipts (blue ticks)
- Typing indicators
- Message history

**✅ Message Timers:**
- Per-message timers: View once, 1min, 2min, 5min, 30min, custom date/time
- Per-conversation default timers
- Keep forever option (no auto-deletion)
- User-side deletion (server retains for admin)
- Visual countdown indicators

**✅ Admin Controls:**
- Full dashboard with analytics
- User approval system
- Connection management (create/remove)
- Message moderation (view/delete)
- System logs and audit trail
- Invite code management
- Real-time activity monitoring

**✅ Security:**
- End-to-end WebSocket encryption (TLS)
- Password hashing (bcrypt cost 12)
- Session management (7-30 day options)
- CSRF protection
- Rate limiting (login attempts, messages)
- HTTPS enforced everywhere

**✅ PWA Features:**
- Install to home screen (all platforms)
- Offline message queue
- Push notifications
- Responsive design (mobile + desktop)
- Service worker caching
- Fast page loads (<1 second)

---

### 3.2 What the System WILL NOT Do (Version 1)

**❌ Excluded from Version 1** (Planned for V2):
- Group chats
- File/image sharing
- Voice/video calls
- User search functionality
- Public user directory
- User-to-user connection requests
- Edit sent messages
- Delete for everyone (only delete from own view)
- Message forwarding
- User blocking (admin controls this)
- Two-factor authentication
- End-to-end encryption (future enhancement)

**❌ Never Will Do:**
- Store data on third-party servers
- Expose messages to external services
- Allow uncontrolled user discovery
- Provide public APIs
- Support commercial use without permission

---

### 3.3 Deliberate Exclusions (Why NOT Included)

**No User Search:**
- ✓ Prevents users from discovering others without permission
- ✓ Maintains admin's complete control
- ✓ Reduces privacy risks
- ✓ Keeps system closed and secure

**No User-Initiated Connections:**
- ✓ Admin approves every relationship
- ✓ Prevents unwanted contact
- ✓ Ensures closed friend circle
- ✓ Reduces spam and abuse

**No Group Chats (V1):**
- ✓ Keeps Version 1 simple and stable
- ✓ One-on-one is priority for MVP
- ✓ Groups add complexity (permissions, moderation)
- ✓ Will be added in V2 after core is solid

**No File Sharing (V1):**
- ✓ Security concerns (malware, illegal content)
- ✓ Storage management complexity
- ✓ Bandwidth considerations
- ✓ Better to perfect core messaging first

---

## 4. HIGH-LEVEL SYSTEM FLOW

### 4.1 User Registration Flow

```
Admin generates invite code (24hr expiry)
   ↓
Admin shares code with friend (WhatsApp/SMS)
   ↓
Friend opens PaVa-Vak URL
   ↓
Enters invite code
   ↓
Fills registration form (name, username, password)
   ↓
System validates code (unused + not expired)
   ↓
Registration request created (status: PENDING)
   ↓
Admin gets notification
   ↓
Admin reviews request in dashboard
   ↓
Admin approves → User can login
Admin rejects → User notified, account deleted
```

---

### 4.2 Message Flow (Real-Time)

```
User A types message to User B
   ↓
User A sets timer (optional: view once, 5min, keep forever)
   ↓
Message sent via WebSocket
   ↓
Server receives message
   ↓
Server validates:
   - User A is authenticated ✓
   - User A can chat with User B (admin allowed) ✓
   - Message content is valid ✓
   ↓
Server stores message in database
   ↓
Server sends to User B via WebSocket (if online)
   ↓
User B receives message instantly (<100ms)
   ↓
User B sees message with timer indicator
   ↓
Timer starts countdown (if set)
   ↓
After timer expires → Message removed from User B's view
   ↓
Message remains on server (admin can still see)
   ↓
Admin can permanently delete if needed
```

---

### 4.3 Admin Connection Creation Flow

```
Admin logs into dashboard
   ↓
Views approved users list
   ↓
Selects User A from dropdown
   ↓
Selects User B from dropdown
   ↓
Clicks "Connect Users"
   ↓
System creates bidirectional connection
   ↓
User A now sees User B in contacts list
   ↓
User B now sees User A in contacts list
   ↓
Both can now chat with each other
   ↓
WebSocket notification sent (if online)
   ↓
Admin can break connection anytime
```

---

## 5. FUNCTIONAL REQUIREMENTS

### 5.1 User Registration & Authentication

**FR-1.1: Invite Code Generation**
- Admin can generate unlimited invite codes
- Each code is unique (UUID format: `PV-XXXX-XXXX`)
- Each code can be used only once
- Each code expires after 24 hours
- Admin can see which user used which code
- Admin can revoke unused codes before expiry

**FR-1.2: User Registration**
- Users access registration via invite code
- Required fields: Full Name, Username, Password
- Optional field: Mobile number
- Username must be unique (3-20 characters, alphanumeric + underscore)
- Password must be strong (min 8 chars, mix of letters/numbers/symbols)
- Registration creates PENDING user
- User cannot login until approved by admin

**FR-1.3: User Approval**
- Admin sees pending registrations in dashboard
- Admin can approve or reject within 48 hours
- Approved users can login immediately
- Rejected users are notified and account is deleted
- Admin can see registration timestamp and invite code used
- Admin can add notes/comments for tracking

**FR-1.4: User Login**
- Username + Password authentication
- Session created on successful login (7 days default)
- Failed login attempts rate-limited (5 attempts per hour per IP)
- "Remember me" option extends session to 30 days
- Logout destroys session immediately
- Multiple device login supported

---

### 5.2 User Visibility & Connection Management

**FR-2.1: Default User Isolation (Zero-Knowledge)**
- New approved users see ZERO contacts initially
- Users cannot see list of all users in system
- Users cannot search for other users
- Only admin has global user view
- Users see message: "Your admin will connect you with friends soon"

**FR-2.2: Admin-Controlled Connections**
- Admin creates connection between User A ↔ User B
- Connection is bidirectional (both see each other automatically)
- Once connected:
  - User A sees User B in contact list
  - User B sees User A in contact list
  - Both can initiate chat
  - Chat history is shared between them
  - Real-time status visible (online/offline/last seen)

**FR-2.3: Connection Removal**
- Admin can break any connection anytime
- When connection broken:
  - Users no longer see each other in contacts
  - Cannot send new messages
  - Old messages remain in database (admin can see)
  - Both users see notification: "Connection removed by admin"
  - No explanation required (admin's discretion)

---

### 5.3 Messaging Features

**FR-3.1: Text Messaging**
- Users can send text messages (max 5000 characters per message)
- Messages delivered in real-time via WebSocket
- Automatic fallback to polling if WebSocket fails
- Message status indicators:
  - ✓ Single tick: Sent to server
  - ✓✓ Double tick: Delivered to recipient
  - ✓✓ Blue ticks: Read by recipient
- Message timestamps in sender's timezone
- Messages stored indefinitely (unless deleted)

**FR-3.2: Emoji Support**
- Full Unicode emoji support (all standard emojis)
- Emoji picker interface in chat
- Recent emojis saved per user
- Emoji search functionality (e.g., search "smile" shows 😊😃😄)
- Skin tone variations supported

**FR-3.3: Message Delivery**
- Online users: Instant WebSocket delivery (<100ms)
- Offline users: Messages queued, delivered on next login
- Push notifications (PWA) for offline users
- Message delivery confirmation
- Retry mechanism for failed deliveries

**FR-3.4: Read Receipts & Typing Indicators**
- Read receipts:
  - Single tick: Sent to server
  - Double tick: Delivered to recipient  
  - Blue ticks: Read by recipient
  - User can disable read receipts in privacy settings
- Typing indicators:
  - "Alice is typing..." shown in real-time
  - Disappears after 3 seconds of inactivity
  - Can be disabled in settings

---

### 5.4 Message Timer System (CRITICAL FEATURE)

**FR-4.1: Timer Options**

Users can set timers when sending messages:

1. **View Once** 👁️
   - Message deleted after recipient reads it
   - Shows "👁️ View once" indicator
   - Deleted after 3 seconds of viewing
   - Cannot be screenshot-protected (technical limitation)

2. **Timed Deletion** ⏱️
   - 1 minute
   - 2 minutes
   - 5 minutes
   - 30 minutes
   - Custom date/time picker (any future date/time)

3. **Keep Forever** ♾️
   - No auto-deletion
   - User must manually delete
   - Default if no timer set

**FR-4.2: Per-Message Timer**
- User selects timer before/while sending each message
- Timer is message-specific
- Different messages in same chat can have different timers
- Timer starts when recipient first views message (not when sent)
- Countdown visible to recipient

**FR-4.3: Per-Conversation Timer**
- User sets default timer for entire conversation
- Applies to all future messages in that chat
- Can override specific messages with different timer
- Setting saved per conversation permanently
- Example: Set "5 minutes" for chat with Bob → all messages auto-set to 5 min

**FR-4.4: Timer Behavior**
- Timer countdown visible to recipient in real-time
- Format: "5:00" → "4:59" → "4:58" → ... → "0:01" → Message disappears
- Deleted from **recipient's view only**
- Message remains in database (admin can always see)
- Sender sees timer status on their side too
- Timer cannot be extended once started

**FR-4.5: Manual Deletion**
- Users can manually delete messages from their view anytime
- Deleted messages remain on server (admin can see)
- User sees: "You deleted this message"
- Other party still sees message (unless they also deleted)
- No "delete for everyone" in V1

---

### 5.5 Admin Dashboard Features

**FR-5.1: User Management**
- View all users with filters:
  - All users
  - Approved users
  - Pending users
  - Banned users
- Approve/reject pending users (bulk operations supported)
- Ban/unban users (with reason notes)
- Delete users permanently (removes all their data)
- See user activity:
  - Last seen timestamp
  - Total messages sent
  - Number of connections
  - Registration date
  - Invite code used

**FR-5.2: Connection Management**
- Visual network graph of all connections
- Create new connections (select 2 users → connect)
- Remove existing connections (select connection → remove)
- Bulk connection operations:
  - Connect multiple users at once
  - Remove multiple connections
- Search connections (by user name/username)
- Export connection list (CSV format)

**FR-5.3: Message Moderation**
- View all messages across all chats
- Search messages by:
  - Keyword
  - Sender
  - Recipient
  - Date range
  - Connection
- Permanently delete messages:
  - Single message deletion
  - Bulk deletion
  - Delete all messages from a user
- Export chat logs for backup (JSON/CSV format)
- Filter by timer status (timed, view once, keep forever)

**FR-5.4: Invite Code Management**
- Generate new codes (single or bulk)
- View all codes with status:
  - Active (unused, not expired)
  - Used (who used it, when)
  - Expired (not used before expiry)
  - Revoked (admin cancelled)
- Revoke active codes
- Extend expiry of active codes
- See which user used which code
- Export code usage report

**FR-5.5: System Monitoring**
- Dashboard overview:
  - Total users (approved, pending, banned)
  - Total messages (today, this week, all time)
  - Active connections count
  - Active users (online now)
  - System health (CPU, RAM, Storage)
  - Server uptime
- Real-time activity feed:
  - Recent messages (live updates)
  - Recent registrations
  - Recent connections created/removed
  - Recent logins
- Alerts for critical events:
  - Server resources >80%
  - Database size approaching limit
  - Multiple failed login attempts
  - Suspicious activity patterns

**FR-5.6: Analytics Dashboard**
- User growth chart (line graph over time)
- Message volume chart (messages per day/week/month)
- Peak activity times (heat map by hour of day)
- Most active users (top 10 by message count)
- Connection network visualization (interactive graph)
- Average response time statistics
- User engagement metrics

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance

**NFR-1.1: Message Delivery Speed**
- Real-time message delivery < 100ms (same region)
- WebSocket connection established < 500ms
- Page load time < 1 second (first load)
- Page load time < 300ms (cached)
- No lag when scrolling chat history (smooth 60fps)

**NFR-1.2: Scalability**
- Support 100 concurrent users without performance degradation
- Handle 10,000 messages per day
- Database optimized for 1 million+ messages
- Graceful degradation under load:
  - Fallback to polling if WebSocket overloaded
  - Queue messages if server busy
  - Never lose messages

**NFR-1.3: Responsiveness**
- UI responsive on mobile (320px width) and desktop (1920px width)
- No full page reloads (single-page application behavior)
- Smooth animations (60fps minimum)
- Efficient DOM updates:
  - Virtual scrolling for long chats (>1000 messages)
  - Lazy loading of images/content
  - Debounced search and filter operations

---

### 6.2 Security

**NFR-2.1: Data Protection**
- All passwords hashed with bcrypt (cost factor 12)
- Session tokens encrypted and stored securely
- Database encrypted at rest (PostgreSQL pgcrypto)
- TLS 1.3 for all connections (HTTP → HTTPS redirect)
- No sensitive data in logs (passwords, tokens masked)
- Secure headers (Helmet.js):
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security
  - Content-Security-Policy

**NFR-2.2: Authentication Security**
- Session timeout after 30 min inactivity
- CSRF tokens on all forms
- Rate limiting on login:
  - 5 attempts per hour per IP
  - 1-hour lockout after limit reached
- Password requirements:
  - Minimum 8 characters
  - Must contain: uppercase, lowercase, number
  - Optional: special character
  - No common passwords (checked against list)
- Secure "Remember Me":
  - Uses secure, long-lived token
  - Token rotated on each use
  - Can be revoked from any device

**NFR-2.3: Authorization**
- Role-based access control (RBAC):
  - Admin role: Full access
  - User role: Limited access
- Every API endpoint checks user role
- WebSocket events check permissions before delivery
- Database queries filter by user permissions
- No client-side permission checks (always server-side)
- Audit log of all admin actions

**NFR-2.4: Input Validation**
- All user inputs sanitized:
  - XSS prevention (HTML escaping)
  - SQL injection prevention (parameterized queries)
  - Command injection prevention
  - Path traversal prevention
- Message length limits enforced (5000 chars)
- Username/password format validation
- File upload validation (when implemented in V2)
- Rate limiting on message sending (10 msg/sec per user)

---

### 6.3 Reliability

**NFR-3.1: Uptime**
- Target 99.5% uptime (acceptable for private system)
- Automatic restart on server crash (PM2 process manager)
- Health check endpoints (for monitoring)
- Graceful shutdown (save state, close connections)
- Recovery from network failures (automatic reconnection)

**NFR-3.2: Data Integrity**
- Database transactions for critical operations:
  - User registration
  - Connection creation/removal
  - Message sending
- Foreign key constraints enforced
- Regular automated backups:
  - Daily full backup
  - Keep 7 daily, 4 weekly, 12 monthly
- Point-in-time recovery possible
- Backup integrity checks (monthly restore test)

**NFR-3.3: Error Handling**
- Graceful error messages (no stack traces to users)
- Automatic retry for failed message delivery (3 attempts)
- Offline message queue (PWA service worker)
- Error logging for debugging:
  - Error type, timestamp, user context
  - Stack trace (server-side only)
- Error categorization:
  - User errors (invalid input)
  - System errors (server issues)
  - Network errors (connection issues)

---

### 6.4 Usability

**NFR-4.1: User Experience**
- Intuitive interface (minimal learning curve)
- Clear, actionable error messages
- Helpful tooltips and inline help
- Onboarding tour for new users (optional)
- Dark mode + Light mode (user preference)
- Consistent UI across pages
- Familiar patterns (like WhatsApp/Telegram)

**NFR-4.2: Accessibility**
- Keyboard navigation support (tab, enter, arrows)
- Screen reader compatible (ARIA labels)
- Sufficient color contrast (WCAG AA standard)
- Responsive font sizes (16px minimum)
- Focus indicators visible
- Alt text for all images
- Semantic HTML

**NFR-4.3: Mobile Optimization**
- Touch-friendly controls (min 44x44px touch targets)
- Swipe gestures:
  - Swipe left on message → Delete
  - Swipe down → Refresh
  - Pull to load more messages
- Virtual keyboard handling (auto-scroll to input)
- Minimal data usage:
  - Compressed messages
  - Lazy load images
  - Cache aggressively
- Works on slow networks (2G/3G)

---

### 6.5 Maintainability

**NFR-5.1: Code Quality**
- Clean, commented code (JSDoc for functions)
- Modular architecture (separation of concerns)
- Consistent naming conventions:
  - camelCase for JavaScript variables/functions
  - PascalCase for classes
  - UPPER_CASE for constants
- DRY principle (Don't Repeat Yourself)
- SOLID principles for OOP
- Unit tests for critical functions (Jest)

**NFR-5.2: Monitoring**
- Comprehensive logging:
  - Info: Normal operations
  - Warning: Unusual but recoverable
  - Error: Failures requiring attention
- User activity logs (who did what, when)
- Performance metrics:
  - Response times
  - Database query times
  - WebSocket latency
- Resource usage monitoring:
  - CPU, RAM, Disk
  - Database size
  - Network bandwidth
- Automated alerts for critical issues:
  - Email notifications
  - Slack/Telegram integration (optional)

**NFR-5.3: Documentation**
- Inline code comments
- API documentation (endpoint specs)
- Database schema documentation
- Deployment guide (step-by-step)
- Troubleshooting guide
- User manual (for end users)
- Admin manual (for system admin)

---

## 7. TECHNOLOGY STACK

### 7.1 Backend Technologies

**Runtime Environment:**
- **Node.js 20 LTS** (JavaScript runtime)
- **Why:** Best for real-time WebSocket applications, massive ecosystem, mature and stable

**Web Framework:**
- **Express.js 4.x** (Minimal, flexible web framework)
- **Why:** Industry standard, well-documented, extensive middleware ecosystem, lightweight

**Real-Time Communication:**
- **Socket.io 4.x** (WebSocket library with fallbacks)
- **Why:**
  - Automatic fallback to polling if WebSocket fails
  - Rooms and namespaces for organizing connections
  - Built-in reconnection logic
  - Event-based messaging
  - Production-proven

**Database:**
- **PostgreSQL 15** (Relational database)
- **Why:**
  - ACID compliant (data integrity)
  - JSON support (flexible data)
  - Full-text search (message search)
  - Mature, reliable, free
  - Excellent performance

**ORM (Object-Relational Mapping):**
- **Prisma** (Modern database toolkit)
- **Why:**
  - Type-safe database access
  - Auto-generated migrations
  - Great developer experience
  - Prevents SQL injection by design

**Authentication & Security:**
- **Passport.js** (Authentication middleware)
- **bcrypt** (Password hashing - cost factor 12)
- **express-session** (Session management)
- **helmet** (HTTP security headers)
- **express-rate-limit** (Rate limiting for APIs)
- **validator.js** (Input validation and sanitization)

**Other Backend Libraries:**
- **dotenv** (Environment variable management)
- **morgan** (HTTP request logger)
- **cors** (Cross-Origin Resource Sharing)
- **compression** (Response compression for performance)

---

### 7.2 Frontend Technologies

**Core Technologies:**
- **HTML5** (Semantic markup)
- **CSS3** (Modern styling)
- **JavaScript ES2024** (Modern JavaScript features)

**UI Framework:**
- **Vanilla JavaScript** (No framework for V1 - keeps it simple and fast)
- **Alternative for V2:** Svelte or Alpine.js if complexity grows

**Styling:**
- **Tailwind CSS** (Utility-first CSS framework)
- **Why:**
  - Rapid development
  - Small bundle size
  - Responsive design utilities
  - Consistent design system
  - No CSS conflicts

**PWA (Progressive Web App):**
- **Workbox** (Service worker library by Google)
- **Why:**
  - Offline support
  - Intelligent caching strategies
  - Push notifications
  - Background sync

**Real-Time Client:**
- **Socket.io Client** (Matches backend Socket.io)
- Automatic reconnection
- Event-based messaging

**Other Frontend Libraries:**
- **emoji-picker-element** (Emoji picker component)
- **date-fns** (Date/time formatting and manipulation)
- **DOMPurify** (XSS sanitization for user content)

---

### 7.3 Database Schema Overview

**Key Tables:**

1. **users** - User accounts and authentication
2. **invite_codes** - Invite code management
3. **connections** - User-to-user relationships
4. **messages** - All chat messages
5. **message_timers** - Auto-delete timer configuration
6. **conversation_timer_settings** - Default timers per conversation
7. **sessions** - Active user sessions
8. **admin_logs** - Audit trail of admin actions

*(Detailed schema in Section 8)*

---

### 7.4 Infrastructure

**Hosting:**
- **Oracle Cloud Free Tier**
- **VM Instance:** VM.Standard.A1.Flex
- **Specs:** 4 ARM cores, 24 GB RAM, 200 GB storage
- **OS:** Ubuntu 22.04 LTS
- **Cost:** $0/month (free forever)

**Web Server:**
- **Nginx** (Reverse proxy + SSL termination)
- **Why:**
  - High performance (handles 10,000+ connections)
  - Load balancing capable
  - Static file serving
  - Gzip compression
  - SSL/TLS handling

**Process Manager:**
- **PM2** (Node.js process manager)
- **Why:**
  - Auto-restart on crash
  - Cluster mode (utilize all CPU cores)
  - Built-in monitoring
  - Log management
  - Zero-downtime reload

**SSL Certificate:**
- **Let's Encrypt** (Free SSL certificates)
- **Certbot** (Auto-renewal tool)
- **Auto-renewal:** Every 90 days

**Domain:**
- **Options:**
  - Free: DuckDNS (free subdomain - recommended)
  - Free: Freenom (.tk, .ml domains)
  - Paid: Your own domain ($10-15/year)

---

### 7.5 Development Tools

**Version Control:**
- **Git** + **GitHub** (Private repository recommended)

**Code Editor:**
- **VS Code** (Recommended)
- **Extensions:**
  - ESLint (code linting)
  - Prettier (code formatting)
  - Prisma (database schema highlighting)
  - GitLens (Git integration)

**Testing:**
- **Jest** (Unit testing framework)
- **Supertest** (API endpoint testing)
- **Playwright** (E2E testing - for V2)

**Monitoring:**
- **PM2 Monitoring** (Built-in process monitoring)
- **PostgreSQL logs** (Database query logs)
- **Custom admin dashboard** (System health monitoring)
- **Optional:** UptimeRobot (free uptime monitoring)

**Development Workflow:**
```
Local Development → Git Commit → Git Push → 
Pull on Server → npm install → PM2 reload
```

---

[CONTINUING WITH REMAINING SECTIONS...]

## 8. DATABASE DESIGN

*(Complete database schema with all tables, relationships, and indexes will continue...)*

---

**Document Status:** ✅ Part 1 Complete  
**Next:** Database Design, Message Timers, Invite Codes, Security, Deployment...

---
