export async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      display_name TEXT,
      profile_picture JSONB,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture JSONB;

    ALTER TABLE users DROP COLUMN IF EXISTS recovery_code_hash;

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('global', 'dm', 'group')),
      name TEXT,
      name_color TEXT,
      name_font TEXT,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      dm_key TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE threads ADD COLUMN IF NOT EXISTS name_color TEXT;
    ALTER TABLE threads ADD COLUMN IF NOT EXISTS name_font TEXT;

    CREATE TABLE IF NOT EXISTS thread_members (
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (thread_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS messages_thread_id_id_idx ON messages (thread_id, id DESC);
    CREATE INDEX IF NOT EXISTS thread_members_user_id_idx ON thread_members (user_id, thread_id);
    CREATE INDEX IF NOT EXISTS threads_last_message_at_idx ON threads (last_message_at DESC);
  `);

  await pool.query(`
    INSERT INTO threads (id, type, name)
    VALUES ('global', 'global', 'Global')
    ON CONFLICT (id) DO NOTHING
  `);
}
