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

  // 2 · cached Spotify responses, so page reloads don't spend the Development Mode quota (M1)
  `
  CREATE TABLE api_cache (
    key         TEXT PRIMARY KEY,                -- e.g. "taste:<user id>"
    value       TEXT NOT NULL,                   -- JSON
    fetched_at  INTEGER NOT NULL                 -- ms since epoch
  );
  `,

  // 3 · suggestion runs and their tracks (M2)
  `
  CREATE TABLE runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     INTEGER NOT NULL,
    mood           TEXT NOT NULL DEFAULT '',
    discovery      TEXT NOT NULL,              -- close | mixed | adventurous
    refined_from   INTEGER REFERENCES runs(id) ON DELETE SET NULL,
    note           TEXT,                       -- the refine note
    asked          INTEGER NOT NULL,           -- how many songs Claude suggested
    dropped        TEXT NOT NULL DEFAULT '[]', -- JSON: [{ artist, title, reason }]
    input_tokens   INTEGER,
    output_tokens  INTEGER,
    duration_ms    INTEGER
  );

  CREATE INDEX runs_user ON runs(user_id, created_at);

  CREATE TABLE run_tracks (
    run_id    INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    track     TEXT NOT NULL,                   -- JSON TrackInfo
    reason    TEXT NOT NULL,
    kind      TEXT NOT NULL,                   -- close | wildcard
    known     INTEGER NOT NULL DEFAULT 0,      -- "You know this" (D14)
    removed   INTEGER NOT NULL DEFAULT 0,      -- taken out with ✕
    PRIMARY KEY (run_id, position)
  );
  `,

  // 4 · which playlist a run was sent to (M3)
  `
  ALTER TABLE runs ADD COLUMN playlist_id TEXT;
  ALTER TABLE runs ADD COLUMN playlist_name TEXT;
  ALTER TABLE runs ADD COLUMN sent_at INTEGER;
  `,
];
