# PaVa-Vak FCM Implementation Guide (Android + Backend)

This guide helps you enable **real Android push notifications** using Firebase Cloud Messaging (FCM), with hidden notification content for privacy.

## 1) Current Status (Already Done)

- Android app has Firebase config (`google-services.json`) in:
  - `android-app/app/src/prod/google-services.json`
- Android app can fetch FCM token successfully.
- You confirmed token logs are visible in logcat.

## 2) Goal

When user A sends a message to user B:
- backend stores message in DB
- backend sends FCM push to user B devices
- user B receives quick notification even if app is background/killed
- notification content stays hidden

---

## 3) Backend Prerequisites

Run on Oracle server:

```bash
cd /home/opc/PaVa-Vak/backend
npm install firebase-admin
```

In Firebase Console:
1. Open your project
2. Go to **Project Settings**
3. Open **Service Accounts**
4. Click **Generate new private key**
5. Download JSON key

Upload key to server:

```bash
mkdir -p /home/opc/PaVa-Vak/backend/secrets
# upload file as:
# /home/opc/PaVa-Vak/backend/secrets/firebase-service-account.json
```

Set env var in backend `.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/home/opc/PaVa-Vak/backend/secrets/firebase-service-account.json
```

Restart backend:

```bash
pm2 restart pavavak
pm2 logs pavavak --lines 100
```

---

## 4) Add Firebase Admin Initializer

Create file: `backend/lib/firebaseAdmin.js`

```js
const admin = require('firebase-admin');
const fs = require('fs');

let initialized = false;

function getFirebaseAdmin() {
  if (initialized) return admin;

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH missing or invalid');
  }

  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  return admin;
}

module.exports = { getFirebaseAdmin };
```

---

## 5) Store Device Tokens in DB

Add a table/model for tokens (example name: `device_tokens`).

Recommended columns:
- `id` (PK)
- `user_id` (FK to users)
- `token` (unique)
- `platform` (`android`)
- `device_id` (optional)
- `is_active` (default true)
- `last_seen_at`
- `created_at`
- `updated_at`

If using Prisma, add model then migrate.

---

## 6) Create Token APIs

### `POST /api/mobile/register-token` (authenticated)
Request body:

```json
{
  "token": "FCM_TOKEN",
  "platform": "android",
  "deviceId": "optional-device-id"
}
```

Behavior:
- validate token
- upsert token row
- map token to logged-in user
- set `is_active=true`, `last_seen_at=now`

### `POST /api/mobile/unregister-token` (authenticated)
Request body:

```json
{
  "token": "FCM_TOKEN"
}
```

Behavior:
- set `is_active=false`

---

## 7) Send FCM in Message Send Route

In `backend/routes/messages.js`, inside `/send` route:
1. Create message in DB (already done)
2. Load receiver active tokens from DB
3. Send FCM to each token
4. Mark invalid tokens inactive if Firebase returns unregistered errors

Use **hidden payload** (no sensitive message text):

```js
{
  data: {
    type: 'new_message',
    messageId: String(message.message_id),
    senderId: String(message.sender_id),
    chatUserId: String(message.sender_id)
  },
  android: {
    priority: 'high',
    notification: {
      channelId: 'pavavak_messages'
    }
  }
}
```

---

## 8) Android App Changes Needed

Already done:
- token fetch + logs
- Firebase service

Still needed:
1. After login success, call `/api/mobile/register-token` with token from `SharedPreferences("fcm_state")`.
2. In `onNewToken`, call same register API.
3. In `onMessageReceived`, continue showing hidden notification:
   - Title: `PaVaVak`
   - Text: `You have a new message`
   - No message body content

---

## 9) Battery-Friendly Recommendation

- Keep push as primary delivery path.
- Use WorkManager only as fallback (15 min periodic max).
- Avoid aggressive polling loops in background.

---

## 10) End-to-End Test Checklist

1. Login on device A and device B
2. Verify both tokens stored in DB
3. Put B in background
4. Send message from A to B
5. Confirm instant push on B
6. Tap notification, open app/chat
7. Kill app on B, repeat test

---

## 11) Useful Commands

### Android token check
```powershell
adb logcat -d -s PaVaVakFCM FirebaseMessaging
```

### PM2 status
```bash
pm2 status
pm2 logs pavavak --lines 100
```

---

## 12) Security Notes

- Keep service account JSON outside public folders.
- Never commit service account JSON to git.
- Notification payload should avoid private chat text.

