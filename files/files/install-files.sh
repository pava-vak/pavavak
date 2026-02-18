#!/bin/bash
# PaVa-Vak Auto-Installer for Linux/Mac
# This script moves downloaded files to their correct locations

echo "╔════════════════════════════════════════╗"
echo "║   PaVa-Vak Auto-Installer (Linux/Mac) ║"
echo "║   Moving files to correct locations   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "ERROR: backend folder not found!"
    echo "Please run ./create-structure.sh first!"
    echo ""
    exit 1
fi

# Set download folder (where you put the downloaded files)
DOWNLOAD_DIR="downloads"
if [ ! -d "$DOWNLOAD_DIR" ]; then
    echo "ERROR: downloads folder not found!"
    echo ""
    echo "Please create a 'downloads' folder and put all downloaded files there."
    echo "Run: mkdir downloads"
    echo "OR change DOWNLOAD_DIR in this script to your download location."
    echo ""
    exit 1
fi

echo "Starting file installation..."
echo ""

# Counters
SUCCESS=0
FAILED=0

# Function to install file
install_file() {
    local source=$1
    local dest=$2
    local name=$3
    
    if [ -f "$source" ]; then
        cp "$source" "$dest"
        echo "✓ $name installed"
        ((SUCCESS++))
    else
        echo "✗ $name not found in downloads folder"
        ((FAILED++))
    fi
}

# Install each file
echo "[1/9] Installing server.js..."
install_file "$DOWNLOAD_DIR/server.js" "backend/server.js" "server.js"

echo "[2/9] Installing package.json..."
install_file "$DOWNLOAD_DIR/package.json" "backend/package.json" "package.json"

echo "[3/9] Installing env-example.txt..."
if [ -f "$DOWNLOAD_DIR/env-example.txt" ]; then
    cp "$DOWNLOAD_DIR/env-example.txt" "backend/.env.example"
    if [ ! -f "backend/.env" ]; then
        cp "$DOWNLOAD_DIR/env-example.txt" "backend/.env"
        echo "✓ env-example.txt installed as .env.example AND .env"
    else
        echo "✓ env-example.txt installed as .env.example (.env already exists)"
    fi
    ((SUCCESS++))
else
    echo "✗ env-example.txt not found in downloads folder"
    ((FAILED++))
fi

echo "[4/9] Installing schema.prisma..."
install_file "$DOWNLOAD_DIR/schema.prisma" "backend/prisma/schema.prisma" "schema.prisma"

echo "[5/9] Installing authMiddleware.js..."
if [ -f "$DOWNLOAD_DIR/authMiddleware.js" ]; then
    cp "$DOWNLOAD_DIR/authMiddleware.js" "backend/middleware/auth.js"
    echo "✓ authMiddleware.js installed as auth.js"
    ((SUCCESS++))
else
    echo "✗ authMiddleware.js not found in downloads folder"
    ((FAILED++))
fi

echo "[6/9] Installing validationMiddleware.js..."
if [ -f "$DOWNLOAD_DIR/validationMiddleware.js" ]; then
    cp "$DOWNLOAD_DIR/validationMiddleware.js" "backend/middleware/validation.js"
    echo "✓ validationMiddleware.js installed as validation.js"
    ((SUCCESS++))
else
    echo "✗ validationMiddleware.js not found in downloads folder"
    ((FAILED++))
fi

echo "[7/9] Installing rateLimiterMiddleware.js..."
if [ -f "$DOWNLOAD_DIR/rateLimiterMiddleware.js" ]; then
    cp "$DOWNLOAD_DIR/rateLimiterMiddleware.js" "backend/middleware/rateLimiter.js"
    echo "✓ rateLimiterMiddleware.js installed as rateLimiter.js"
    ((SUCCESS++))
else
    echo "✗ rateLimiterMiddleware.js not found in downloads folder"
    ((FAILED++))
fi

echo "[8/9] Installing authRoutes.js..."
if [ -f "$DOWNLOAD_DIR/authRoutes.js" ]; then
    cp "$DOWNLOAD_DIR/authRoutes.js" "backend/routes/auth.js"
    echo "✓ authRoutes.js installed as auth.js"
    ((SUCCESS++))
else
    echo "✗ authRoutes.js not found in downloads folder"
    ((FAILED++))
fi

echo "[9/9] Installing loggerUtil.js..."
if [ -f "$DOWNLOAD_DIR/loggerUtil.js" ]; then
    cp "$DOWNLOAD_DIR/loggerUtil.js" "backend/utils/logger.js"
    echo "✓ loggerUtil.js installed as logger.js"
    ((SUCCESS++))
else
    echo "✗ loggerUtil.js not found in downloads folder"
    ((FAILED++))
fi

echo ""
echo "════════════════════════════════════════"
echo "Installation Summary:"
echo "✓ Successfully installed: $SUCCESS files"
echo "✗ Failed to install: $FAILED files"
echo "════════════════════════════════════════"
echo ""

if [ $SUCCESS -gt 0 ]; then
    echo "Next steps:"
    echo "1. Edit backend/.env with your database password and settings"
    echo "2. Run: cd backend && npm install"
    echo "3. Follow DEPLOYMENT_GUIDE.md"
    echo ""
fi

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Some files were not found!"
    echo "Please check that all files are in the 'downloads' folder."
    echo ""
fi

echo "Installation complete!"
echo ""
