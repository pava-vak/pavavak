#!/bin/bash
# PaVa-Vak Folder Structure Generator (Linux/Mac)
# Run this in your project root directory

echo "╔════════════════════════════════════════╗"
echo "║  PaVa-Vak Folder Structure Creator    ║"
echo "║  Creating all folders and files...    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Create main directories
echo "Creating main directories..."
mkdir -p backend/prisma
mkdir -p backend/middleware
mkdir -p backend/routes
mkdir -p backend/controllers
mkdir -p backend/utils
mkdir -p backend/scripts
mkdir -p frontend/css
mkdir -p frontend/js
mkdir -p frontend/assets/icons
mkdir -p deployment
mkdir -p docs

echo "✓ Directories created"
echo ""

# Create empty backend files
echo "Creating backend files..."
touch backend/middleware/validation.js
touch backend/middleware/rateLimiter.js
touch backend/routes/auth.js
touch backend/routes/messages.js
touch backend/routes/admin.js
touch backend/routes/connections.js
touch backend/routes/invites.js
touch backend/routes/users.js
touch backend/controllers/authController.js
touch backend/controllers/messageController.js
touch backend/controllers/adminController.js
touch backend/controllers/userController.js
touch backend/utils/logger.js
touch backend/utils/emailer.js
touch backend/utils/twoFactor.js
touch backend/utils/encryption.js
touch backend/scripts/createAdmin.js
touch backend/scripts/cleanup.js

echo "✓ Backend files created"
echo ""

# Create empty frontend files
echo "Creating frontend files..."
touch frontend/index.html
touch frontend/register.html
touch frontend/chat.html
touch frontend/admin.html
touch frontend/css/main.css
touch frontend/css/chat.css
touch frontend/css/admin.css
touch frontend/js/app.js
touch frontend/js/auth.js
touch frontend/js/chat.js
touch frontend/js/admin.js
touch frontend/js/socket.js
touch frontend/manifest.json
touch frontend/sw.js

echo "✓ Frontend files created"
echo ""

# Create deployment files
echo "Creating deployment files..."
touch deployment/nginx.conf
touch deployment/pm2.config.js
touch deployment/oracle-setup.sh
touch deployment/backup.sh

# Make scripts executable
chmod +x deployment/oracle-setup.sh
chmod +x deployment/backup.sh

echo "✓ Deployment files created"
echo ""

# Create documentation files
echo "Creating documentation files..."
touch docs/API.md
touch docs/DATABASE.md
touch docs/SECURITY.md
touch LICENSE

echo "✓ Documentation files created"
echo ""

# Create .env from example
echo "Creating .env placeholder..."
if [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "⚠️  Don't forget to edit backend/.env with your settings!"
else
    echo "⚠️  backend/.env.example not found - you'll need to create .env manually"
fi
echo ""

# Show completion
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✓ STRUCTURE CREATED SUCCESSFULLY!    ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your settings"
echo "2. Copy files from Claude into their locations"
echo "3. Run: cd backend && npm install"
echo "4. Follow DEPLOYMENT_GUIDE.md"
echo ""
echo "Folder structure:"
echo ""

# Show tree if available, otherwise use find
if command -v tree &> /dev/null; then
    tree -L 3 -I 'node_modules'
else
    find . -type d -not -path '*/node_modules/*' | sed 's|[^/]*/|  |g'
fi

echo ""
echo "All done! 🚀"
echo ""
