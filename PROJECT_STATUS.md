## PaVa-Vak Project Status

**Current date:** March 10, 2026  
**Primary deployment target:** Google Cloud Run (`asia-south1`)  
**Primary client focus:** Android app

### Current Reality

The repository is well beyond the original foundation stage. Active code exists in:

- `backend/` for auth, messaging, admin, diagnostics, mobile token APIs, Socket.IO, and Prisma
- `frontend/` for web login/chat/admin/settings/PWA pages
- `android-app/` for native chat, admin tools, lock screen, local storage, sync, and notifications

### Recently Completed

- Google Cloud Run deployment path and Cloud Run URL migration in active frontend pages
- Admin-managed forgot password flow:
  - user submits reset request
  - admin sees pending reset requests
  - admin generates one-time password
  - user is forced to set a new password after OTP login
- Android admin chat navigation bounce fix in app lock lifecycle
- FCM code path improvements on backend and Android receiver side
- Local encrypted/offline-first Android chat infrastructure groundwork:
  - local message cache
  - pending send queue
  - periodic/background retry scheduler

### Remaining Active Work

These are the main open items still being stabilized:

1. Android chat-open performance
   - remove redundant fetches on first open
   - reduce extra session calls
   - batch read updates instead of one request per message

2. Background notification verification
   - confirm Cloud Run FCM credentials are correct
   - confirm token registration on deployed backend
   - confirm pushes arrive when receiver app is backgrounded or closed

3. Documentation cleanup
   - replace stale Oracle-era guidance with current Cloud Run reality
   - refresh Android docs to reflect current architecture
   - fill missing API documentation

### Code Health Snapshot

- Backend route/runtime files currently parse cleanly with `node --check`
- Android code was previously compiling locally, but full compile could not be revalidated in the restricted environment once Gradle attempted a network download

### Recommended Next Order

1. Finish Android chat-open performance fixes
2. Redeploy backend to Cloud Run
3. Verify FCM end-to-end with real devices
4. Build and test updated APK
5. Commit only after those checks pass
