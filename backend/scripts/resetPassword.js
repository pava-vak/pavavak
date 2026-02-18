#!/usr/bin/env node
// Reset Password Script
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

async function resetPassword() {
  console.log('\n========================================');
  console.log('   PaVa-Vak Password Reset');
  console.log('========================================\n');

  try {
    const username = await question('Enter username to reset: ');
    
    const user = await prisma.users.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      console.log('\n❌ User not found!\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`\nFound user: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Admin: ${user.is_admin ? 'Yes' : 'No'}`);
    console.log(`Approved: ${user.is_approved ? 'Yes' : 'No'}\n`);

    const newPassword = await question('Enter new password (min 8 characters): ');

    if (newPassword.length < 8) {
      console.log('\n❌ Password must be at least 8 characters!\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    const confirmPassword = await question('Confirm new password: ');

    if (newPassword !== confirmPassword) {
      console.log('\n❌ Passwords do not match!\n');
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.users.update({
      where: { user_id: user.user_id },
      data: { 
        password_hash: passwordHash,
        two_factor_enabled: false,
        two_factor_secret: null
      }
    });

    console.log('\n========================================');
    console.log('✅ Password reset successfully!');
    console.log('========================================');
    console.log(`\nUsername: ${user.username}`);
    console.log(`New Password: ${newPassword}`);
    console.log(`\n⚠️  Save these credentials!`);
    console.log(`\n🎯 Next steps:`);
    console.log(`   1. Login at: http://localhost:3000`);
    console.log(`   2. Username: ${user.username}`);
    console.log(`   3. Password: (the one you just set)\n`);

    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

resetPassword();