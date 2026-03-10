const prisma = require('./prisma');

async function ensureProfilePrivacySchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hide_last_seen BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_photo_base64 TEXT;
  `);
}

module.exports = { ensureProfilePrivacySchema };
