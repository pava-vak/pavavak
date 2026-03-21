const prisma = require('./prisma');

async function ensureBroadcastSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      broadcast_id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      target_mode TEXT NOT NULL DEFAULT 'all',
      include_self BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS broadcast_recipients (
      id BIGSERIAL PRIMARY KEY,
      broadcast_id BIGINT NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE ON UPDATE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      delivery_status TEXT NOT NULL DEFAULT 'pending',
      token_count INTEGER NOT NULL DEFAULT 0,
      sent_notifications INTEGER NOT NULL DEFAULT 0,
      failed_notifications INTEGER NOT NULL DEFAULT 0,
      read_at TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      UNIQUE (broadcast_id, user_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS broadcast_recipients_user_id_created_at_idx
    ON broadcast_recipients(user_id, created_at DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS broadcast_recipients_user_id_read_at_idx
    ON broadcast_recipients(user_id, read_at);
  `);
}

module.exports = { ensureBroadcastSchema };
