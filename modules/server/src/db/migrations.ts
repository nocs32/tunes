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

  // 5 · thumbs up / down on suggested songs (M4). One vote per song per person.
  `
  CREATE TABLE feedback (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL,                 -- Spotify track id
    isrc        TEXT,
    artist      TEXT NOT NULL,                 -- for the profile text
    title       TEXT NOT NULL,
    vote        TEXT NOT NULL,                 -- up | down
    run_id      INTEGER REFERENCES runs(id) ON DELETE SET NULL,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE INDEX feedback_recent ON feedback(user_id, created_at);
  `,

  // 6 · the song a "More like this" run is built around (JSON TrackInfo), or NULL
  `
  ALTER TABLE runs ADD COLUMN seed TEXT;
  `,

  // 7 · the crate: songs collected for a "Find more like these" mix (at most 10 per person).
  //     runs.seed (6) now holds a JSON array of the songs a run was built around.
  `
  CREATE TABLE crate (
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id  TEXT NOT NULL,
    track     TEXT NOT NULL,                   -- JSON TrackInfo
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );
  `,

  // 8 · the full streaming history (D24, D26): per-song totals from Spotify's data export, built in
  //     the browser. Never single plays, IP addresses, devices or countries. Re-importing replaces it.
  `
  CREATE TABLE history_tracks (
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uri       TEXT NOT NULL,                   -- spotify:track:…
    artist    TEXT NOT NULL,
    title     TEXT NOT NULL,
    plays     INTEGER NOT NULL,                -- plays of 30 s or more
    skips     INTEGER NOT NULL,
    finishes  INTEGER NOT NULL,                -- played to the end
    first_at  INTEGER,                         -- first / last play of 30 s or more (ms), NULL if none
    last_at   INTEGER,
    months    TEXT NOT NULL,                   -- JSON {"2026-03": 4}: plays of 30 s or more per month (UTC)
    PRIMARY KEY (user_id, uri)
  );

  CREATE TABLE history_imports (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    imported_at  INTEGER NOT NULL,
    first_at     INTEGER,
    last_at      INTEGER,
    plays        INTEGER NOT NULL,
    tracks       INTEGER NOT NULL
  );
  `,
];
