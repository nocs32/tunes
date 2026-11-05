// Each entry runs once, in order. SQLite's `user_version` remembers how many have run.
// Never edit a migration that has shipped; add a new one instead.

export const migrations: readonly string[] = [
  // 1 · users and login sessions (M1)
  `
  CREATE TABLE users (
    id                TEXT PRIMARY KEY,          -- Spotify user id
    display_name      TEXT NOT NULL,
    image_url         TEXT,
    access_token      TEXT NOT NULL,             -- encrypted (AES-GCM)
    refresh_token     TEXT NOT NULL,             -- encrypted (AES-GCM)
    token_expires_at  INTEGER NOT NULL,          -- ms since epoch
    authorized_at     INTEGER NOT NULL,          -- refresh tokens die ~6 months after this
    playlist_id       TEXT,                      -- the rolling playlist (D7)
    settings          TEXT NOT NULL DEFAULT '{}',
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,                -- random, sent as an httpOnly cookie
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  CREATE INDEX sessions_user ON sessions(user_id);
  `,
];
