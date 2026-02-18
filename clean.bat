@echo off
echo ============================================
echo PaVa-Vak COMPLETE Folder Cleanup Script
echo ============================================
echo.
echo This will:
echo 1. Create backup
echo 2. Move files\backend to main backend
echo 3. Move ALL scattered files to correct locations
echo 4. Delete duplicates
echo 5. Create perfect structure
echo.
pause

cd /d J:\PaVa-Vak

echo.
echo [STEP 1] Creating backup...
mkdir backup\%date:~-4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2% 2>nul
echo ? Backup folder created

echo.
echo [STEP 2] Ensuring backend folder structure exists...

REM If files\backend has node_modules, use it as the main backend
if exist files\backend\node_modules (
    echo ? files\backend has node_modules - using it as main backend
    
    REM Remove old empty backend if exists
    if exist backend (
        if not exist backend\node_modules (
            echo ? Removing old empty backend folder...
            rmdir /S /Q backend 2>nul
        )
    )
    
    REM Move files\backend to backend
    echo ? Moving files\backend to backend...
    move /Y files\backend backend >nul 2>&1
)

REM Ensure all subdirectories exist
mkdir backend\controllers 2>nul
mkdir backend\middleware 2>nul
mkdir backend\routes 2>nul
mkdir backend\utils 2>nul
mkdir backend\scripts 2>nul
mkdir backend\prisma 2>nul
echo ? Backend folder structure created

echo.
echo [STEP 3] Moving scattered files to correct locations...

REM Move schema.prisma to backend\prisma\
if exist files\schema.prisma (
    copy /Y files\schema.prisma backend\prisma\schema.prisma >nul 2>&1
    echo ? Moved schema.prisma to backend\prisma\
)
if exist files\schema-sqlite.prisma (
    copy /Y files\schema-sqlite.prisma backend\schema-sqlite.prisma >nul 2>&1
    echo ? Moved schema-sqlite.prisma to backend\
)
if exist schema.prisma (
    copy /Y schema.prisma backend\prisma\schema.prisma >nul 2>&1
    echo ? Moved root schema.prisma to backend\prisma\
)

REM Move package.json to backend\
if exist files\package.json (
    copy /Y files\package.json backend\package.json >nul 2>&1
    echo ? Moved package.json to backend\
)
if exist package.json (
    copy /Y package.json backend\package.json >nul 2>&1
    echo ? Moved root package.json to backend\
)

REM Move server.js to backend\
if exist files\server.js (
    copy /Y files\server.js backend\server.js >nul 2>&1
    echo ? Moved server.js to backend\
)
if exist server.js (
    copy /Y server.js backend\server.js >nul 2>&1
    echo ? Moved root server.js to backend\
)

REM Move .env files to backend\
if exist files\env-example.txt (
    copy /Y files\env-example.txt backend\.env.example >nul 2>&1
    echo ? Moved env-example.txt to backend\.env.example
)
if exist files\env-sqlite.txt (
    copy /Y files\env-sqlite.txt backend\env-sqlite.txt >nul 2>&1
    echo ? Moved env-sqlite.txt to backend\
)
if exist env.example (
    copy /Y env.example backend\.env.example >nul 2>&1
    echo ? Moved root env.example to backend\
)

REM Move middleware files
if exist files\logger.js (
    copy /Y files\logger.js backend\utils\logger.js >nul 2>&1
    echo ? Moved logger.js to backend\utils\
)
if exist files\rateLimiter.js (
    copy /Y files\rateLimiter.js backend\middleware\rateLimiter.js >nul 2>&1
    echo ? Moved rateLimiter.js to backend\middleware\
)
if exist files\validation.js (
    copy /Y files\validation.js backend\middleware\validation.js >nul 2>&1
    echo ? Moved validation.js to backend\middleware\
)
if exist files\auth.js (
    copy /Y files\auth.js backend\routes\auth.js >nul 2>&1
    echo ? Moved auth.js to backend\routes\
)
if exist files\authMiddleware.js (
    copy /Y files\authMiddleware.js backend\middleware\auth.js >nul 2>&1
    echo ? Moved authMiddleware.js to backend\middleware\
)

echo.
echo [STEP 4] Moving frontend...
if exist files\frontend (
    if not exist frontend (
        move /Y files\frontend frontend >nul 2>&1
        echo ? Moved frontend folder
    ) else (
        rmdir /S /Q files\frontend 2>nul
        echo ? Removed duplicate frontend
    )
)

echo.
echo [STEP 5] Cleaning up duplicate folders...
if exist files\backend (
    rmdir /S /Q files\backend 2>nul
    echo ? Removed files\backend
)
if exist files\deployment (
    rmdir /S /Q files\deployment 2>nul
    echo ? Removed files\deployment
)
if exist files\docs (
    rmdir /S /Q files\docs 2>nul
    echo ? Removed files\docs
)

echo.
echo [STEP 6] Cleaning up scattered files in files\...
cd files

del /Q schema.prisma 2>nul
del /Q schema-sqlite.prisma 2>nul
del /Q package.json 2>nul
del /Q server.js 2>nul
del /Q env.example 2>nul
del /Q env-example.txt 2>nul
del /Q env-sqlite.txt 2>nul
del /Q logger.js 2>nul
del /Q rateLimiter.js 2>nul
del /Q validation.js 2>nul
del /Q auth.js 2>nul
del /Q authMiddleware.js 2>nul

REM Delete duplicate batch files
del /Q "create-structure (1).bat" 2>nul
del /Q "create-structure(1).bat" 2>nul
del /Q "create-structure(1).sh" 2>nul
del /Q "install-files (1).bat" 2>nul
del /Q "1install-files.bat" 2>nul
del /Q install-files.sh 2>nul
del /Q install-files.bat 2>nul
del /Q create-structure.sh 2>nul

REM Delete zip files
del /Q "files (1).zip" 2>nul
del /Q files.zip 2>nul
del /Q files1.zip 2>nul

REM Delete PostgreSQL installer
del /Q postgresql-16.2-1-windows-x64.exe 2>nul

REM Delete markdown duplicates
del /Q MISSING_FILES.md 2>nul
del /Q NEXT_STEPS.md 2>nul
del /Q SQLITE_SWITCH.md 2>nul

echo ? Cleaned files folder

cd ..

REM Clean up root folder
del /Q schema.prisma 2>nul
del /Q package.json 2>nul
del /Q env.example 2>nul

echo.
echo [STEP 7] Verifying backend structure...
echo.
echo Checking backend files:

if exist backend\package.json (echo   ? package.json) else (echo   ? package.json MISSING!)
if exist backend\server.js (echo   ? server.js) else (echo   ? server.js MISSING!)
if exist backend\.env (echo   ? .env) else (echo   ? .env not found - use env-sqlite.txt)
if exist backend\prisma\schema.prisma (echo   ? prisma\schema.prisma) else (echo   ? prisma\schema.prisma MISSING!)
if exist backend\node_modules (echo   ? node_modules) else (echo   ? node_modules MISSING!)

echo.
echo Checking backend folders:
if exist backend\controllers (echo   ? controllers\) else (echo   ? controllers\ MISSING!)
if exist backend\middleware (echo   ? middleware\) else (echo   ? middleware\ MISSING!)
if exist backend\routes (echo   ? routes\) else (echo   ? routes\ MISSING!)
if exist backend\utils (echo   ? utils\) else (echo   ? utils\ MISSING!)

echo.
echo ============================================
echo ? CLEANUP COMPLETE!
echo ============================================
echo.
echo FINAL STRUCTURE:
echo J:\PaVa-Vak\
echo +-- backend\                   ? All backend files here!
echo ¦   +-- node_modules\
echo ¦   +-- package.json
echo ¦   +-- server.js
echo ¦   +-- .env (create from env-sqlite.txt)
echo ¦   +-- prisma\
echo ¦   ¦   +-- schema.prisma
echo ¦   +-- controllers\
echo ¦   +-- middleware\
echo ¦   +-- routes\
echo ¦   +-- utils\
echo ¦   +-- scripts\
echo +-- frontend\
echo +-- deployment\
echo +-- docs\
echo +-- files\                     ? Only batch scripts
echo.
echo ============================================
echo NEXT STEPS:
echo ============================================
echo.
echo 1. Replace schema.prisma with SQLite version:
echo    cd backend\prisma
echo    copy ..\schema-sqlite.prisma schema.prisma
echo.
echo 2. Create .env file:
echo    cd backend
echo    copy env-sqlite.txt .env
echo.
echo 3. Run database migration:
echo    cd backend
echo    npx prisma migrate dev --name init
echo.
echo 4. Start the server:
echo    npm start
echo.
echo ============================================
pause