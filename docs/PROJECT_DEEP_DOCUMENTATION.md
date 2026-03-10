# PaVa-Vak Deep Project Documentation

This document provides a deep, practical architecture and implementation overview of the current PaVa-Vak codebase across:

- `backend/`
- `frontend/`
- `android-app/`
- deployment/operations context

---

## 1. Product Scope

PaVa-Vak is a private/admin-controlled messaging platform with:

- Session-based authentication (web + Android)
- Admin-controlled onboarding and approvals
- One-to-one messaging with read/delivery behavior
- Admin moderation and diagnostics
- Web/PWA client and native Android client
- Push notification integration path (web + FCM)

---

## 2. Repository Structure

Primary modules:

- `backend/`  
  Node.js/Express API, auth/session, Socket.IO, Prisma + PostgreSQL integration, admin tools, mobile APIs.

- `frontend/`  
  Multi-page web app (`index.html`, `chat.html`, `admin.html`, `settings.html`, diagnostics pages) with vanilla JS.

- `android-app/`  
  Native Android app in Kotlin with lock/biometric security, native chat UI, admin screens, optional WebView pages.

- `deployment/`  
  Deployment scripts and runbooks, currently aligned to Google Cloud Run workflow.

---

## 3. High-Level Architecture

### 3.1 Clients

- **Web client (`frontend`)** uses `/api/*` and Socket.IO endpoints.
- **Android native client (`android-app`)** uses `/api/*` via `NativeApi.kt`.
- **Android WebView screens** load selected web routes (admin/user web mode).

### 3.2 Server

- `backend/server.js` is the main runtime.
- Express handles REST APIs.
- Socket.IO handles real-time events.
- Passport + `express-session` provides session authentication.
- Sessions are persisted in PostgreSQL with `connect-pg-simple`.
- Prisma is the DB access layer.

### 3.3 State Model

- Persistent source of truth: PostgreSQL tables via Prisma.
- Identity/session state: cookie + Passport session.
- Realtime transient state: in-process `onlineUsers` map.
- Android transient local state: pending message queue + local reaction/reply prefs.

---

## 4. Backend Deep Documentation

### 4.1 Core Runtime (`backend/server.js`)

Responsibilities:

- App/server initialization.
- Middleware setup:
  - `helmet`
  - `compression`
  - JSON/urlencoded body parsing
  - `cors`
  - `morgan`
- Session setup with PostgreSQL store.
- Passport local strategy + serialize/deserialize.
- API route mounting.
- Push endpoints and manifest endpoint.
- Health endpoint (`/api/health`).
- Static frontend hosting + SPA fallback.
- Socket.IO connection/auth/event handling.
- Shutdown + watchdog routines:
  - graceful shutdown
  - memory monitor
  - DB keepalive

### 4.2 Authentication Model

Authentication type:

- Session-based authentication (cookie session; not JWT-first).
- Username/password verified through Passport LocalStrategy.
- User must be approved (`is_approved`) to login.

Middleware (`backend/middleware/auth.js`):

- `isAuthenticated(req,res,next)`
- `isAdmin(req,res,next)`
- `authenticate` alias

### 4.3 API Route Families

Mounted route prefixes include:

- `/api/auth`
- `/api/messages`
- `/api/admin`
- `/api/connections`
- `/api/invites`
- `/api/users`
- `/api/diagnostic`
- `/api/mobile`
- `/api/push/*` (in main server file)

### 4.4 Realtime (Socket.IO)

Behavior in `server.js`:

- Session is attached/checked during socket handshake.
- Tracks online/offline users and emits `user_status`.
- Supports typing events via `user_typing`.
- On connect, server emits message delivery signals for unread incoming messages.

### 4.5 Health and Diagnostics

Main ops endpoints:

- `/api/health` for app/DB basics.
- `/api/diagnostic/status` for richer health info.
- `/api/diagnostic/logs` for log snippets.
- `/api/diagnostic/restart` for restart trigger (protected key).

Diagnostics data includes:

- DB latency/status
- memory/disk/system basics
- PM2 status/restarts
- app environment + online users

### 4.6 Data Domain (Observed + docs)

Core entities include:

- users
- invite codes
- connections
- messages
- message timers
- sessions
- admin/system logs
- login attempts
- password reset requests
- device tokens (mobile push)

Design intent:

- Admin controls onboarding and allowable communication graph.
- Messaging includes status and moderation controls.

---

## 5. Frontend Deep Documentation

### 5.1 Client Type

- Multi-page app (MPA) using vanilla JS.
- Primary script files under `frontend/js/`.
- API base is generally relative (`/api`) for active pages.

### 5.2 Primary Pages

- `index.html` (login/landing)
- `register.html`
- `chat.html`
- `admin.html`
- `settings.html`
- diagnostics pages (`diagnostic.html`, `status.html`)

### 5.3 Core JS Modules

- `js/chat.js`:
  - conversation list
  - message send/read/delete/clear
  - Socket.IO event consumption
  - typing indicator and UI state

- `js/admin.js`:
  - dashboard stats
  - user moderation
  - reset link flows
  - connection management
  - invite/log/message tools

- `js/settings.js`:
  - profile/account data + updates

- `js/pwa.js` and `sw.js`:
  - service worker lifecycle
  - install flow and offline behavior

### 5.4 Time Display Notes

Core active UI paths can be configured to IST (`Asia/Kolkata`) for predictable display behavior.  
Some legacy pages can still contain old locale assumptions if not explicitly updated.

---

## 6. Android Deep Documentation

### 6.1 Build and Flavors

Module:

- `android-app/app`

Flavors:

- `prod`
- `clone`

Base URL:

- Controlled by `BuildConfig.BASE_URL` in `app/build.gradle.kts`.

### 6.2 Android Security Posture

Current hardening points:

- `allowBackup=false`
- `usesCleartextTraffic=false`
- network security config bound to configured host
- lock/decoy/biometric path for local app security

### 6.3 Entry and Routing Flow

- `MainActivity`:
  - checks session
  - checks admin vs user
  - checks lock setup status
  - routes to `AdminHomeActivity`, `LoginActivity`, `LockActivity`, or native chat

- `LoginActivity`:
  - uses `NativeApi.login()`
  - initializes notification bootstrap and routes into app

### 6.4 Native Chat Stack

Core files:

- `nativechat/ChatListActivity.kt`
- `nativechat/ChatActivity.kt`
- `nativechat/MessageAdapter.kt`
- `nativechat/NativeApi.kt`
- `nativechat/ChatModels.kt`

Implemented behaviors:

- native conversation list and messaging
- pending local message state
- message selection + delete
- clear chat
- reply preview UI
- reaction UI/persistence (local preference storage)
- admin conversation access via admin APIs

Time formatting:

- Message times are formatted via `NativeApi.formatTime(...)`.
- IST can be enforced via `ZoneId.of("Asia/Kolkata")`.

### 6.5 Admin Native Screens

- `AdminHomeActivity`
- `AdminMessagesActivity`
- `AdminConversationListActivity`
- `AdminConversationActivity`

Admin native capabilities:

- view stats
- moderate/delete messages
- inspect conversations
- clear conversations
- jump to web admin via WebView activity

### 6.6 WebView Activities

- `UserWebActivity`
- `AdminWebActivity`

Current configuration highlights:

- JavaScript enabled
- DOM storage enabled
- mixed content blocked
- cookie manager integration

### 6.7 Notifications

FCM components:

- `PaVaVakFirebaseMessagingService`
- `NotificationBootstrap`
- `NotificationHelper`
- related worker/bootstrap classes

Flow:

- retrieve token
- register token with backend mobile endpoint
- display notifications through helper stack

---

## 7. End-to-End Flow Documentation

### 7.1 Authentication

1. Client submits credentials to `/api/auth/login`.
2. Server validates and starts session.
3. Session cookie persisted server-side via PG session store.
4. Client checks `/api/auth/session`.
5. Role-based routing to admin or user surfaces.

### 7.2 Messaging

1. Sender posts message (`/api/messages/send`).
2. Backend persists message.
3. Receiver gets updates through polling/API and/or Socket.IO.
4. Read endpoint updates read state.
5. Delivery/read indicators reflected in UI.

### 7.3 Admin Moderation

1. Admin auth + role check.
2. Admin tools fetch users/invites/messages/logs/connections.
3. Admin performs approval/rejection/moderation actions.
4. Diagnostics tools assist runtime monitoring and restart paths.

---

## 8. Deployment and Runtime Direction

Current project direction is simplified Google deployment (Cloud Run based):

- Build container image
- Deploy service in target region
- Keep backend and frontend served from same service origin where applicable
- Android `BASE_URL` should match active deployed service URL

---

## 9. Known Engineering Hotspots (Cross-Module)

1. **Legacy vs current flows coexist**  
   Some legacy pages/routes/scripts can diverge from active production path.

2. **Security hardening opportunities**  
   Diagnostics protections, render sanitization, strict env enforcement can be improved.

3. **Realtime + polling overlap**  
   Some clients combine realtime and frequent polling; optimization can reduce load.

4. **Client-side local-only UX state**  
   Reactions/reply previews can be local-only unless backend persistence contract is explicit.

5. **Ops page drift risk**  
   Status/diagnostics pages can retain old infrastructure references after migrations.

---

## 10. Recommended Documentation Set to Maintain

For ongoing maintainability, keep these documents updated:

1. `docs/ARCHITECTURE.md`
2. `docs/API_CONTRACT.md`
3. `docs/ANDROID_CLIENT.md`
4. `docs/SECURITY_MODEL.md`
5. `docs/DEPLOYMENT_GCP.md`
6. `docs/OPERATIONS_RUNBOOK.md`
7. `docs/RELEASE_CHECKLIST.md`

---

## 11. Practical Notes for Current Team Workflow

- Prefer changing one layer at a time (Android, backend, frontend) with explicit contracts.
- Whenever chat metadata fields are added (reply/reaction/etc.), define request/response keys in one API contract doc before coding clients.
- Keep a single canonical base URL source for Android builds (`BuildConfig.BASE_URL`) and keep web relative-path API usage where possible.
- After each deploy:
  - validate `/api/health`
  - test login/session persistence
  - test send/read flows
  - test admin moderation endpoints
  - verify push token registration

---

## 12. Appendix: Active Module Index

### Backend key files

- `backend/server.js`
- `backend/middleware/auth.js`
- `backend/routes/auth.js`
- `backend/routes/messages.js`
- `backend/routes/admin.js`
- `backend/routes/diagnostic.js`
- `backend/routes/mobile.js`
- `backend/lib/prisma.js`

### Frontend key files

- `frontend/index.html`
- `frontend/chat.html`
- `frontend/admin.html`
- `frontend/settings.html`
- `frontend/js/chat.js`
- `frontend/js/admin.js`
- `frontend/js/settings.js`
- `frontend/sw.js`

### Android key files

- `android-app/app/build.gradle.kts`
- `android-app/app/src/main/AndroidManifest.xml`
- `android-app/app/src/main/java/com/pavavak/app/MainActivity.kt`
- `android-app/app/src/main/java/com/pavavak/app/LoginActivity.kt`
- `android-app/app/src/main/java/com/pavavak/app/nativechat/NativeApi.kt`
- `android-app/app/src/main/java/com/pavavak/app/nativechat/ChatActivity.kt`
- `android-app/app/src/main/java/com/pavavak/app/nativechat/MessageAdapter.kt`
- `android-app/app/src/main/java/com/pavavak/app/AdminHomeActivity.kt`

