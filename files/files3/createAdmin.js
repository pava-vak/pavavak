#!/usr/bin/env node
// Create Admin User Script
// Usage: node scripts/createAdmin.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('\n========================================');
  console.log('   PaVa-Vak Admin Account Creation');
  console.log('========================================\n');

  try {
    // Check if admin already exists
    const existingAdmin = await prisma.users.findFirst({
      where: { is_admin: true }
    });

    if (existingAdmin) {
      console.log('⚠️  An admin account already exists!');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}\n`);
      
      const overwrite = await question('Do you want to create another admin? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('\nExiting...\n');
        rl.close();
        await prisma.$disconnect();
        process.exit(0);
      }
    }

    // Get admin details from environment variables or prompt
    let username = process.env.ADMIN_USERNAME;
    let password = process.env.ADMIN_PASSWORD;
    let email = process.env.ADMIN_EMAIL;
    let fullName = process.env.ADMIN_FULLNAME || 'System Administrator';

    // If not in environment, prompt user
    if (!username) {
      username = await question('Enter admin username: ');
    }

    if (!email) {
      email = await question('Enter admin email: ');
    }

    if (!password) {
      password = await question('Enter admin password (min 8 characters): ');
      
      if (password.length < 8) {
        console.log('\n❌ Error: Password must be at least 8 characters long\n');
        rl.close();
        await prisma.$disconnect();
        process.exit(1);
      }
    }

    // Validate input
    if (!username || !email || !password) {
      console.log('\n❌ Error: All fields are required\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    // Check if username already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      console.log('\n❌ Error: Username or email already exists\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('\nCreating admin account...');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const admin = await prisma.users.create({
      data: {
        username: username.toLowerCase(),
        password_hash: passwordHash,
        email: email.toLowerCase(),
        full_name: fullName,
        is_admin: true,
        is_approved: true,
        two_factor_enabled: false,
        created_at: new Date(),
        last_login: null
      }
    });

    // Create a default invite code for testing
    const inviteCode = 'PV-ADMIN-TEST';
    try {
      await prisma.invite_codes.create({
        data: {
          code: inviteCode,
          used: false,
          created_at: new Date()
        }
      });
      console.log(`\n✅ Default invite code created: ${inviteCode}`);
    } catch (error) {
      // Invite code might already exist, ignore error
    }

    console.log('\n========================================');
    console.log('✅ Admin account created successfully!');
    console.log('========================================');
    console.log(`\n📧 Email:    ${admin.email}`);
    console.log(`👤 Username: ${admin.username}`);
    console.log(`🔑 User ID:  ${admin.user_id}`);
    console.log(`\n⚠️  Please login and change your password if you used a temporary one.`);
    console.log(`\n🎯 Next steps:`);
    console.log(`   1. Start the server: npm start`);
    console.log(`   2. Login at: ${process.env.DOMAIN || 'http://localhost:3000'}`);
    console.log(`   3. Go to Admin Dashboard`);
    console.log(`   4. Generate invite codes for new users`);
    console.log(`   5. Create connections between users\n`);

    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin account:', error.message);
    console.error('\nDetails:', error);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle Ctrl+C
rl.on('SIGINT', async () => {
  console.log('\n\nOperation cancelled by user\n');
  rl.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
createAdmin();
