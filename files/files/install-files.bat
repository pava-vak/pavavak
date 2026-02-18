@echo off
REM PaVa-Vak Auto-Installer for Windows
REM This script moves downloaded files to their correct locations

echo ╔════════════════════════════════════════╗
echo ║   PaVa-Vak Auto-Installer (Windows)   ║
echo ║   Moving files to correct locations   ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if we're in the right directory
if not exist "backend" (
    echo ERROR: backend folder not found!
    echo Please run create-structure.bat first!
    echo.
    pause
    exit /b 1
)

REM Set download folder (where you put the downloaded files)
set DOWNLOAD_DIR=downloads
if not exist "%DOWNLOAD_DIR%" (
    echo ERROR: downloads folder not found!
    echo.
    echo Please create a 'downloads' folder and put all downloaded files there.
    echo OR change DOWNLOAD_DIR in this script to your download location.
    echo.
    pause
    exit /b 1
)

echo Starting file installation...
echo.

REM Counter for success/fail
set SUCCESS=0
set FAILED=0

REM Install each file
echo [1/9] Installing server.js...
if exist "%DOWNLOAD_DIR%\server.js" (
    copy "%DOWNLOAD_DIR%\server.js" "backend\server.js" >nul
    echo ✓ server.js installed
    set /a SUCCESS+=1
) else (
    echo ✗ server.js not found in downloads folder
    set /a FAILED+=1
)

echo [2/9] Installing package.json...
if exist "%DOWNLOAD_DIR%\package.json" (
    copy "%DOWNLOAD_DIR%\package.json" "backend\package.json" >nul
    echo ✓ package.json installed
    set /a SUCCESS+=1
) else (
    echo ✗ package.json not found in downloads folder
    set /a FAILED+=1
)

echo [3/9] Installing env-example.txt...
if exist "%DOWNLOAD_DIR%\env-example.txt" (
    copy "%DOWNLOAD_DIR%\env-example.txt" "backend\.env.example" >nul
    if not exist "backend\.env" (
        copy "%DOWNLOAD_DIR%\env-example.txt" "backend\.env" >nul
        echo ✓ env-example.txt installed as .env.example AND .env
    ) else (
        echo ✓ env-example.txt installed as .env.example (.env already exists)
    )
    set /a SUCCESS+=1
) else (
    echo ✗ env-example.txt not found in downloads folder
    set /a FAILED+=1
)

echo [4/9] Installing schema.prisma...
if exist "%DOWNLOAD_DIR%\schema.prisma" (
    copy "%DOWNLOAD_DIR%\schema.prisma" "backend\prisma\schema.prisma" >nul
    echo ✓ schema.prisma installed
    set /a SUCCESS+=1
) else (
    echo ✗ schema.prisma not found in downloads folder
    set /a FAILED+=1
)

echo [5/9] Installing authMiddleware.js...
if exist "%DOWNLOAD_DIR%\authMiddleware.js" (
    copy "%DOWNLOAD_DIR%\authMiddleware.js" "backend\middleware\auth.js" >nul
    echo ✓ authMiddleware.js installed as auth.js
    set /a SUCCESS+=1
) else (
    echo ✗ authMiddleware.js not found in downloads folder
    set /a FAILED+=1
)

echo [6/9] Installing validationMiddleware.js...
if exist "%DOWNLOAD_DIR%\validationMiddleware.js" (
    copy "%DOWNLOAD_DIR%\validationMiddleware.js" "backend\middleware\validation.js" >nul
    echo ✓ validationMiddleware.js installed as validation.js
    set /a SUCCESS+=1
) else (
    echo ✗ validationMiddleware.js not found in downloads folder
    set /a FAILED+=1
)

echo [7/9] Installing rateLimiterMiddleware.js...
if exist "%DOWNLOAD_DIR%\rateLimiterMiddleware.js" (
    copy "%DOWNLOAD_DIR%\rateLimiterMiddleware.js" "backend\middleware\rateLimiter.js" >nul
    echo ✓ rateLimiterMiddleware.js installed as rateLimiter.js
    set /a SUCCESS+=1
) else (
    echo ✗ rateLimiterMiddleware.js not found in downloads folder
    set /a FAILED+=1
)

echo [8/9] Installing authRoutes.js...
if exist "%DOWNLOAD_DIR%\authRoutes.js" (
    copy "%DOWNLOAD_DIR%\authRoutes.js" "backend\routes\auth.js" >nul
    echo ✓ authRoutes.js installed as auth.js
    set /a SUCCESS+=1
) else (
    echo ✗ authRoutes.js not found in downloads folder
    set /a FAILED+=1
)

echo [9/9] Installing loggerUtil.js...
if exist "%DOWNLOAD_DIR%\loggerUtil.js" (
    copy "%DOWNLOAD_DIR%\loggerUtil.js" "backend\utils\logger.js" >nul
    echo ✓ loggerUtil.js installed as logger.js
    set /a SUCCESS+=1
) else (
    echo ✗ loggerUtil.js not found in downloads folder
    set /a FAILED+=1
)

echo.
echo ════════════════════════════════════════
echo Installation Summary:
echo ✓ Successfully installed: %SUCCESS% files
echo ✗ Failed to install: %FAILED% files
echo ════════════════════════════════════════
echo.

if %SUCCESS% GTR 0 (
    echo Next steps:
    echo 1. Edit backend\.env with your database password and settings
    echo 2. Run: cd backend ^&^& npm install
    echo 3. Follow DEPLOYMENT_GUIDE.md
    echo.
)

if %FAILED% GTR 0 (
    echo ⚠️  Some files were not found!
    echo Please check that all files are in the 'downloads' folder.
    echo.
)

echo Installation complete!
echo.
pause
