const prisma = require('./prisma');

async function ensurePasswordResetSchema() {
  // Idempotent additive bootstrap for environments where migrations were not applied.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_hash TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMP(3);
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_used_at TIMESTAMP(3);
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      request_id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP(3)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS password_reset_requests_user_id_status_idx
    ON password_reset_requests(user_id, status);
  `);
}

module.exports = {
  ensurePasswordResetSchema
};
