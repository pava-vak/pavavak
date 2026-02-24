# PaVa-Vak Android App (Separate Project)

This Android app is isolated in `android-app/` and does not modify existing web/backend files.

## Current Backend URL
- `http://144.24.129.194:3000`
- Configured in `android-app/app/build.gradle.kts` as `BuildConfig.BASE_URL`.

## What Is Implemented
- Native lock screen with PIN
- Optional biometric unlock
- Secure WebView host
- Screenshot/screen recording block (`FLAG_SECURE`)
- Native session check (`/api/auth/session`) to route start page:
  - `admin.html` for admins
  - `chat.html` for users
  - `index.html` if not authenticated
- Re-lock when app goes to background and user returns

## Open And Build
1. Open `android-app/` in Android Studio.
2. Let Gradle sync.
3. Run app on Android 8.0+ device/emulator.

## Important Notes
- Cleartext HTTP is enabled for current Oracle IP in:
  - `android-app/app/src/main/res/xml/network_security_config.xml`
  - `android-app/app/src/main/AndroidManifest.xml`
- When domain + HTTPS is ready, switch `BuildConfig.BASE_URL` to `https://...` and disable cleartext.
