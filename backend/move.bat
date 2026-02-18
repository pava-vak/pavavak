@echo off
echo ============================================
echo Moving Files to Correct Locations
echo ============================================
echo.

cd /d J:\PaVa-Vak\backend

echo [STEP 1] Moving route files from utils to routes...
move /Y utils\admin.js routes\admin.js
move /Y utils\connections.js routes\connections.js
move /Y utils\invites.js routes\invites.js
move /Y utils\messages.js routes\messages.js
move /Y utils\users.js routes\users.js

echo.
echo ✓ Route files moved!
echo.

echo [STEP 2] Checking what's left in utils folder...
dir utils

echo.
echo ============================================
echo FILES MOVED SUCCESSFULLY!
echo ============================================
echo.
echo ROUTES FOLDER NOW HAS:
dir routes
echo.
echo UTILS FOLDER NOW HAS:
dir utils
echo.
echo ============================================
echo NEXT STEPS:
echo ============================================
echo 1. Download these 3 files:
echo    - encryption.js
echo    - emailer.js
echo    - twoFactor.js
echo.
echo 2. Save them to: J:\PaVa-Vak\backend\utils\
echo.
echo 3. Run: npm start
echo.
pause