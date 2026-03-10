# PaVa-Vak Android App

This Android app is no longer just a thin wrapper around the web UI. It now has native flows for:

- login and session routing
- admin home and admin message tools
- native chat list and chat screen
- local message cache and queued sends
- app lock, biometric unlock, and decoy mode
- FCM notification bootstrap and hidden-content notification display
- forced password reset flow after admin-issued OTP login

## Backend URL

The active production backend is:

- `https://pavavak-750508954318.asia-south1.run.app`

This is configured in:

- `android-app/app/build.gradle.kts`

## Important Architecture Note

The Android app depends on backend APIs. It is not isolated from backend changes anymore. Features such as:

- native chat
- admin dashboards
- password reset OTP flow
- message delivery/read state
- FCM token registration

all require matching backend support.

## Main Native Areas

- `app/src/main/java/com/pavavak/app/MainActivity.kt`
- `app/src/main/java/com/pavavak/app/LoginActivity.kt`
- `app/src/main/java/com/pavavak/app/AdminHomeActivity.kt`
- `app/src/main/java/com/pavavak/app/nativechat/`
- `app/src/main/java/com/pavavak/app/notifications/`
- `app/src/main/java/com/pavavak/app/data/`
- `app/src/main/java/com/pavavak/app/sync/`

## Current Known Work Areas

- chat open is being optimized to reduce redundant network calls
- background FCM delivery still needs final deployment-side verification
- some legacy WebView/admin paths still exist, but native paths are the primary focus

## Build Notes

- `usesCleartextTraffic` is disabled
- network security config is bound to the Cloud Run host
- release/debug builds depend on normal Gradle and Firebase setup

## Recommended Test Focus

1. Login and forced password reset flow
2. Admin `Open Chat UI`
3. Chat open time with existing message history
4. Background message notifications
5. Offline send queue and later sync
