-- Add delivered/edit metadata to messages and add media_assets for true media pipeline
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS media_assets (
  media_id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL UNIQUE,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  byte_size INTEGER NOT NULL,
  preview_bytes BYTEA,
  content_bytes BYTEA NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT media_assets_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES messages(message_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT media_assets_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT media_assets_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS media_assets_sender_id_receiver_id_idx
  ON media_assets(sender_id, receiver_id);

CREATE INDEX IF NOT EXISTS media_assets_created_at_idx
  ON media_assets(created_at);

CREATE INDEX IF NOT EXISTS messages_receiver_id_delivered_at_idx
  ON messages(receiver_id, delivered_at);

CREATE INDEX IF NOT EXISTS messages_sender_id_read_at_idx
  ON messages(sender_id, read_at);
