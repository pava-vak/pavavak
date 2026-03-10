# 🚀 PAVA-VAK DEPLOYMENT GUIDE

## Complete Step-by-Step Deployment Instructions

**Estimated Time:** 2-3 hours (first time)  
**Skill Level:** Beginner-friendly (copy-paste commands)  
**Cost:** $0 (100% FREE)

---

## 📦 WHAT YOU'RE GETTING

### **Backend** (`/backend` folder):
- ✅ Node.js server (Express framework)
- ✅ WebSocket real-time messaging (Socket.io)
- ✅ PostgreSQL database integration
- ✅ 2FA (Email + Google Authenticator)
- ✅ Encrypted backups
- ✅ Comprehensive logging
- ✅ Security features (rate limiting, CSRF, XSS protection)
- ✅ Admin APIs
- ✅ User APIs

### **Frontend** (`/frontend` folder):
- ✅ Landing/Login page
- ✅ User registration
- ✅ Chat interface (WhatsApp-like)
- ✅ Admin dashboard
- ✅ PWA configuration (installable app)
- ✅ Service worker (offline support)
- ✅ Responsive design (mobile + desktop)

### **Database** (`/database` folder):
- ✅ Complete schema (11 tables)
- ✅ Migrations
- ✅ Seed data (admin account)

### **Deployment** (`/deployment` folder):
- ✅ Oracle Cloud setup script
- ✅ Nginx configuration
- ✅ PM2 configuration
- ✅ SSL setup (Let's Encrypt)
- ✅ Backup automation

---

## 🎯 DEPLOYMENT PHASES

### **PHASE 1: Oracle Cloud Setup** (30 minutes)
1. Create Oracle Cloud account
2. Create VM instance
3. Configure firewall
4. SSH access setup

### **PHASE 2: Server Configuration** (30 minutes)
5. Update system
6. Install Node.js
7. Install PostgreSQL
8. Install Nginx
9. Install PM2

### **PHASE 3: Application Deployment** (45 minutes)
10. Upload code to server
11. Install dependencies
12. Configure environment variables
13. Setup database
14. Create admin account

### **PHASE 4: SSL & Domain** (15 minutes)
15. Setup DuckDNS domain
16. Install SSL certificate
17. Configure Nginx

### **PHASE 5: Launch** (15 minutes)
18. Start application
19. Test everything
20. Create first invite code
21. **GO LIVE!** 🎉

---

## 📋 PRE-REQUISITES

### **What You Need:**

1. **Email Account (Gmail recommended)**
   - For 2FA and notifications
   - Must enable "App Passwords"

2. **Credit/Debit Card**
   - For Oracle Cloud verification (NOT charged)
   - Visa, Mastercard, or RuPay

3. **Computer with:**
   - Terminal/Command Prompt
   - Internet connection
   - SSH client (built-in on Mac/Linux, PuTTY for Windows)

4. **30 minutes of focused time**
   - No interruptions recommended

---

## ✅ STEP-BY-STEP INSTRUCTIONS

### **PHASE 1: Oracle Cloud Account**

#### Step 1.1: Sign Up

1. Go to: https://cloud.oracle.com
2. Click "Start for Free"
3. Fill in details:
   - **Country:** India
   - **Name:** Your name
   - **Email:** Your email
   - **Phone:** Your mobile number

4. Verify email (check inbox)

5. Complete registration:
   - Set password (strong!)
   - Enter credit card (verification only, no charge)
   - Card will show ₹2 temporary hold (refunded in 3-5 days)

6. **Important:** Note your "Cloud Account Name" (generated automatically)

#### Step 1.2: Create VM Instance

1. Login to Oracle Cloud Console
2. Navigate: **Menu → Compute → Instances**
3. Click **"Create Instance"**

4. **Configure Instance:**
   ```
   Name: pavavak-server
   
   Placement:
   - Region: Mumbai (or closest to you)
   
   Image:
   - Image: Ubuntu
   - Version: 22.04
   
   Shape:
   - Shape: VM.Standard.A1.Flex
   - OCPU: 4 (max free tier)
   - Memory: 24 GB (max free tier)
   
   Networking:
   - VCN: Default VCN
   - Subnet: Public subnet
   - Public IP: Assign public IPv4
   
   Boot Volume:
   - Size: 50 GB
   
   SSH Keys:
   - Generate key pair (DOWNLOAD PRIVATE KEY!)
   - Save as: pavavak-ssh-key.key
   ```

5. Click **"Create"**

6. Wait 2-5 minutes (status will change to "Running")

7. **IMPORTANT:** Note your **Public IP Address**
   - Example: `123.45.67.89`
   - You'll need this!

#### Step 1.3: Configure Firewall

1. In Oracle Console, go to your instance
2. Click on **VCN name** (e.g., "vcn-20260211-...")
3. Click **Security Lists → Default Security List**
4. Click **"Add Ingress Rules"**

Add these rules (one by one):

**Rule 1: HTTP**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 80
Description: HTTP
```

**Rule 2: HTTPS**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 443
Description: HTTPS
```

**Rule 3: Custom App (optional backup)**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port: 3000
Description: Node.js App
```

---

### **PHASE 2: Connect to Server**

#### Step 2.1: SSH Connection

**On Mac/Linux:**
```bash
# Set permissions
chmod 400 pavavak-ssh-key.key

# Connect
ssh -i pavavak-ssh-key.key ubuntu@YOUR_PUBLIC_IP
```

**On Windows (using PuTTY):**
1. Download PuTTY: https://www.putty.org/
2. Convert .key to .ppk using PuTTYgen
3. Open PuTTY:
   - Host: ubuntu@YOUR_PUBLIC_IP
   - Port: 22
   - Auth: Browse to .ppk file
   - Click "Open"

#### Step 2.2: Update System

```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y

# Install essentials
sudo apt install -y curl wget git ufw build-essential
```

#### Step 2.3: Configure Server Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

### **PHASE 3: Install Software**

#### Step 3.1: Install Node.js 20

```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 20
nvm install 20

# Verify
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

#### Step 3.2: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE pavavak_db;
CREATE USER pavavak_user WITH PASSWORD 'ChangeThisStrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE pavavak_db TO pavavak_user;
ALTER DATABASE pavavak_db OWNER TO pavavak_user;
\q
EOF
```

**IMPORTANT:** Change `'ChangeThisStrongPassword123!'` to a strong password!

#### Step 3.3: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start service
sudo systemctl start nginx
sudo systemctl enable nginx

# Test: Open browser, go to http://YOUR_PUBLIC_IP
# You should see "Welcome to nginx"
```

#### Step 3.4: Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Setup startup script
pm2 startup
# Run the command it suggests (copy-paste the output)

# Example output:
# sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v20.x.x/bin...
# Copy and run that command
```

---

### **PHASE 4: Upload Application**

#### Step 4.1: Clone/Upload Code

**Option A: Git (Recommended)**
```bash
# On server
cd ~
git clone YOUR_GITHUB_REPO_URL pavavak
cd pavavak/backend
```

**Option B: SCP Upload**
```bash
# On your local machine
scp -i pavavak-ssh-key.key -r pavavak ubuntu@YOUR_PUBLIC_IP:~/
```

#### Step 4.2: Install Dependencies

```bash
cd ~/pavavak/backend
npm install
```

#### Step 4.3: Configure Environment

```bash
# Copy example to actual .env
cp .env.example .env

# Edit .env
nano .env
```

**Fill in these values:**
```env
# Required changes:
DATABASE_URL="postgresql://pavavak_user:YOUR_DB_PASSWORD@localhost:5432/pavavak_db"
SESSION_SECRET="$(openssl rand -base64 64)"
DOMAIN=https://pavavak.duckdns.org  # Your domain (we'll setup next)

# Email (for 2FA)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Admin account (first-time setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourStrongAdminPassword123!
ADMIN_EMAIL=your-email@gmail.com

# Backup encryption
BACKUP_ENCRYPTION_KEY=YourBackupPassword123!
```

**To get Gmail App Password:**
1. Go to: https://myaccount.google.com/apppasswords
2. Create app password for "Mail"
3. Copy 16-character password
4. Paste in `EMAIL_PASSWORD`

Save and exit (Ctrl+X, Y, Enter)

#### Step 4.4: Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Create admin account (run Node script we'll provide)
node scripts/createAdmin.js
```

---

### **PHASE 5: Domain & SSL**

#### Step 5.1: Setup DuckDNS (Free Domain)

1. Go to: https://www.duckdns.org/
2. Login with Google/GitHub
3. Create subdomain: `pavavak` (or your choice)
4. Point to your Oracle IP: `123.45.67.89`
5. Note your full domain: `pavavak.duckdns.org`

#### Step 5.2: Install SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Stop nginx temporarily
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone -d pavavak.duckdns.org

# Follow prompts:
# - Enter email
# - Agree to terms
# - Certificate issued!

# Start nginx
sudo systemctl start nginx
```

#### Step 5.3: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/pavavak
```

**Paste this configuration:**
```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name pavavak.duckdns.org;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name pavavak.duckdns.org;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/pavavak.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pavavak.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Static files
    location / {
        root /home/ubuntu/pavavak/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save (Ctrl+X, Y, Enter)

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/pavavak /etc/nginx/sites-enabled/

# Remove default
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If OK, reload
sudo systemctl reload nginx
```

---

### **PHASE 6: Launch Application**

#### Step 6.1: Start with PM2

```bash
cd ~/pavavak/backend

# Start application
pm2 start server.js --name pavavak

# Save PM2 configuration
pm2 save

# Check status
pm2 status

# View logs
pm2 logs pavavak
```

#### Step 6.2: Setup Automated Backups

```bash
# Create backup script
nano ~/backup-pavavak.sh
```

**Paste this:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
DB_NAME="pavavak_db"
DB_USER="pavavak_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD="YOUR_DB_PASSWORD" pg_dump -U $DB_USER $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Encrypt backup
gpg --batch --yes --passphrase "YOUR_BACKUP_PASSWORD" -c $BACKUP_DIR/backup_$DATE.sql

# Remove unencrypted
rm $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 backups
ls -t $BACKUP_DIR/*.sql.gpg | tail -n +8 | xargs -r rm
```

Save and make executable:
```bash
chmod +x ~/backup-pavavak.sh

# Test backup
./backup-pavavak.sh

# Schedule daily backup (2 AM)
crontab -e

# Add this line:
0 2 * * * /home/ubuntu/backup-pavavak.sh
```

---

### **PHASE 7: Test & Launch**

#### Step 7.1: Test Application

1. Open browser: `https://pavavak.duckdns.org`
2. You should see the login page
3. Login with admin credentials
4. You should see admin dashboard

#### Step 7.2: Generate First Invite Code

1. In admin dashboard → Invite Codes
2. Click "Generate Code"
3. Copy code (e.g., `PV-ABC1-2XY3`)
4. Test registration:
   - Open in incognito/private window
   - Use invite code
   - Register new user
   - Approve from admin dashboard
   - Test messaging

#### Step 7.3: Install as PWA

**On Android:**
1. Open `https://pavavak.duckdns.org` in Chrome
2. Tap menu → "Add to Home screen"
3. App icon created!

**On iOS:**
1. Open in Safari
2. Tap Share → "Add to Home Screen"

**On Desktop:**
1. Chrome shows install icon in address bar
2. Click to install

---

## 🎉 SUCCESS! You're Live!

### **Next Steps:**

1. ✅ Invite your friends (generate codes)
2. ✅ Create connections in admin dashboard
3. ✅ Start chatting!
4. ✅ Monitor in admin dashboard

---

## 🔧 MAINTENANCE

### **Daily:**
- Check admin dashboard (2 minutes)
- Review new registrations

### **Weekly:**
- Check server health: `pm2 status`
- Review logs: `pm2 logs pavavak --lines 50`
- Check disk space: `df -h`

### **Monthly:**
- Update system: `sudo apt update && sudo apt upgrade -y`
- Test backup restore
- Review security logs

---

## 🆘 TROUBLESHOOTING

### **App won't start:**
```bash
pm2 logs pavavak --err
# Check error messages
```

### **Can't connect to database:**
```bash
sudo systemctl status postgresql
# Ensure PostgreSQL is running
```

### **Nginx errors:**
```bash
sudo nginx -t
# Check configuration
```

### **SSL certificate expired:**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 📞 SUPPORT

If you encounter issues:
1. Check logs: `pm2 logs pavavak`
2. Check this guide again
3. Ask me (Claude) for help!

---

**🚀 Congratulations! PaVa-Vak is now LIVE!**

**Total Cost: $0/month**  
**Your Data: 100% Private**  
**Your Control: Complete**

Enjoy your secure, private chat system! 🎊
# Current deployment note

This file is legacy Oracle-first guidance kept only for reference.

Use the current Cloud Run guide instead:

- [GOOGLE_CLOUD_RUN_RUNBOOK.md](/j:/PaVa-Vak/deployment/GOOGLE_CLOUD_RUN_RUNBOOK.md)
