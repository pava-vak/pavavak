@echo off
REM PaVa-Vak Folder Structure Generator (Windows)
REM Run this in your project root directory

echo ╔════════════════════════════════════════╗
echo ║  PaVa-Vak Folder Structure Creator    ║
echo ║  Creating all folders and files...    ║
echo ╚════════════════════════════════════════╝
echo.

REM Create main directories
echo Creating main directories...
mkdir backend 2>nul
mkdir backend\prisma 2>nul
mkdir backend\middleware 2>nul
mkdir backend\routes 2>nul
mkdir backend\controllers 2>nul
mkdir backend\utils 2>nul
mkdir backend\scripts 2>nul
mkdir frontend 2>nul
mkdir frontend\css 2>nul
mkdir frontend\js 2>nul
mkdir frontend\assets 2>nul
mkdir frontend\assets\icons 2>nul
mkdir deployment 2>nul
mkdir docs 2>nul

echo ✓ Directories created
echo.

REM Create empty backend files
echo Creating backend files...
type nul > backend\middleware\validation.js
type nul > backend\middleware\rateLimiter.js
type nul > backend\routes\auth.js
type nul > backend\routes\messages.js
type nul > backend\routes\admin.js
type nul > backend\routes\connections.js
type nul > backend\routes\invites.js
type nul > backend\routes\users.js
type nul > backend\controllers\authController.js
type nul > backend\controllers\messageController.js
type nul > backend\controllers\adminController.js
type nul > backend\controllers\userController.js
type nul > backend\utils\logger.js
type nul > backend\utils\emailer.js
type nul > backend\utils\twoFactor.js
type nul > backend\utils\encryption.js
type nul > backend\scripts\createAdmin.js
type nul > backend\scripts\cleanup.js

echo ✓ Backend files created
echo.

REM Create empty frontend files
echo Creating frontend files...
type nul > frontend\index.html
type nul > frontend\register.html
type nul > frontend\chat.html
type nul > frontend\admin.html
type nul > frontend\css\main.css
type nul > frontend\css\chat.css
type nul > frontend\css\admin.css
type nul > frontend\js\app.js
type nul > frontend\js\auth.js
type nul > frontend\js\chat.js
type nul > frontend\js\admin.js
type nul > frontend\js\socket.js
type nul > frontend\manifest.json
type nul > frontend\sw.js

echo ✓ Frontend files created
echo.

REM Create deployment files
echo Creating deployment files...
type nul > deployment\nginx.conf
type nul > deployment\pm2.config.js
type nul > deployment\oracle-setup.sh
type nul > deployment\backup.sh

echo ✓ Deployment files created
echo.

REM Create documentation files
echo Creating documentation files...
type nul > docs\API.md
type nul > docs\DATABASE.md
type nul > docs\SECURITY.md
type nul > LICENSE

echo ✓ Documentation files created
echo.

REM Create placeholder .env file
echo Creating .env placeholder...
copy backend\.env.example backend\.env 2>nul
echo ⚠️  Don't forget to edit backend\.env with your settings!
echo.

REM Show structure
echo.
echo ╔════════════════════════════════════════╗
echo ║  ✓ STRUCTURE CREATED SUCCESSFULLY!    ║
echo ╚════════════════════════════════════════╝
echo.
echo Next steps:
echo 1. Edit backend\.env with your settings
echo 2. Copy files from Claude into their locations
echo 3. Run: cd backend ^&^& npm install
echo 4. Follow DEPLOYMENT_GUIDE.md
echo.
echo Press any key to view folder structure...
pause >nul

REM Show folder tree
tree /F /A

echo.
echo All done! 🚀
echo.
pause
