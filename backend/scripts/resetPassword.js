#!/usr/bin/env node
/*
Password reset CLI

Usage:
  node scripts/resetPassword.js --user <username> --password <newPassword>
  node scripts/resetPassword.js --all [--exclude-admins] [--exclude-self <username>]
  node scripts/resetPassword.js
*/

require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');
const prisma = require('../lib/prisma');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function parseArgs(argv) {
  const out = {
    user: null,
    password: null,
    all: false,
    excludeAdmins: false,
    excludeSelf: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user') out.user = argv[i + 1];
    if (a === '--password') out.password = argv[i + 1];
    if (a === '--all') out.all = true;
    if (a === '--exclude-admins') out.excludeAdmins = true;
    if (a === '--exclude-self') out.excludeSelf = argv[i + 1];
  }
  return out;
}

function generateTemporaryPassword() {
  return (
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}

function printUsage() {
  console.log('Password reset CLI');
  console.log('Usage:');
  console.log('  node scripts/resetPassword.js --user <username> --password <newPassword>');
  console.log('  node scripts/resetPassword.js --all [--exclude-admins] [--exclude-self <username>]');
  console.log('  node scripts/resetPassword.js');
}

async function resetSingleUser(usernameInput, passwordInput) {
  const username = usernameInput.toLowerCase().trim();
  const user = await prisma.users.findFirst({
    where: { username },
    select: { user_id: true, username: true, email: true, is_admin: true, is_approved: true }
  });

  if (!user) {
    console.log('User not found.');
    process.exitCode = 1;
    return;
  }

  const newPassword = passwordInput.trim();
  if (newPassword.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.users.update({
    where: { user_id: user.user_id },
    data: {
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expiry: null,
      two_factor_enabled: false,
      two_factor_secret: null
    }
  });

  console.log('Password reset successful.');
  console.log(`username: ${user.username}`);
  console.log(`email: ${user.email || ''}`);
  console.log(`admin: ${user.is_admin ? 'yes' : 'no'}`);
}

async function resetAllUsers(opts) {
  const users = await prisma.users.findMany({
    select: { user_id: true, username: true, email: true, is_admin: true },
    orderBy: { user_id: 'asc' }
  });

  const targets = users.filter((u) => {
    if (opts.excludeAdmins && u.is_admin) return false;
    if (opts.excludeSelf && u.username === opts.excludeSelf.toLowerCase()) return false;
    return true;
  });

  if (!targets.length) {
    console.log('No users matched for bulk reset.');
    process.exitCode = 1;
    return;
  }

  console.log('user_id,username,email,is_admin,temporary_password');

  for (const user of targets) {
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.users.update({
      where: { user_id: user.user_id },
      data: {
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expiry: null,
        two_factor_enabled: false,
        two_factor_secret: null
      }
    });

    console.log(
      `${user.user_id},${user.username},${user.email || ''},${user.is_admin ? 'yes' : 'no'},${tempPassword}`
    );
  }

  console.log(`Total reset: ${targets.length}`);
}

async function runInteractive() {
  console.log('Interactive password reset');
  const username = (await question('Enter username: ')).trim().toLowerCase();
  if (!username) {
    console.log('Username is required.');
    process.exitCode = 1;
    return;
  }

  const newPassword = await question('Enter new password (min 8): ');
  const confirmPassword = await question('Confirm new password: ');

  if (newPassword !== confirmPassword) {
    console.log('Passwords do not match.');
    process.exitCode = 1;
    return;
  }

  await resetSingleUser(username, newPassword);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  if (args.all) {
    await resetAllUsers(args);
    return;
  }

  if (args.user || args.password) {
    if (!args.user || !args.password) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    await resetSingleUser(args.user, args.password);
    return;
  }

  await runInteractive();
}

main()
  .catch((error) => {
    console.error('Reset script error:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });