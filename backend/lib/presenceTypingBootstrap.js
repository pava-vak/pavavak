const prisma = require('./prisma');

async function ensurePresenceTypingSchema() {
  // Idempotent, additive bootstrap for deployments where Prisma migration
  // has not run yet. Does not alter existing tables.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      is_online BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      last_heartbeat_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS user_presence_is_online_updated_at_idx
    ON user_presence(is_online, updated_at);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS typing_status (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      is_typing BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP(3) NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS typing_status_from_user_id_to_user_id_key
    ON typing_status(from_user_id, to_user_id);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS typing_status_to_user_id_from_user_id_expires_at_idx
    ON typing_status(to_user_id, from_user_id, expires_at);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS typing_status_expires_at_idx
    ON typing_status(expires_at);
  `);
}

module.exports = {
  ensurePresenceTypingSchema
};

