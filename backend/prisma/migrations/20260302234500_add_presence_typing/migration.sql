-- Additive presence and typing tables (no changes to existing tables)
CREATE TABLE IF NOT EXISTS user_presence (
    user_id INTEGER PRIMARY KEY,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_presence_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS user_presence_is_online_updated_at_idx
ON user_presence(is_online, updated_at);

CREATE TABLE IF NOT EXISTS typing_status (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    is_typing BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT typing_status_from_user_id_fkey
      FOREIGN KEY (from_user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
    CONSTRAINT typing_status_to_user_id_fkey
      FOREIGN KEY (to_user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS typing_status_from_user_id_to_user_id_key
ON typing_status(from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS typing_status_to_user_id_from_user_id_expires_at_idx
ON typing_status(to_user_id, from_user_id, expires_at);

CREATE INDEX IF NOT EXISTS typing_status_expires_at_idx
ON typing_status(expires_at);
