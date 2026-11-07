import type { Db } from '../db/index.ts';

// The imported streaming history: one row per song with its totals (migration 8).

export type HistoryTrack = {
  uri: string;
  artist: string;
  title: string;
  plays: number;
  skips: number;
  finishes: number;
  firstAt: number | null;
  lastAt: number | null;
  // Plays of 30 s or more per month, "2026-03" (UTC).
  months: Record<string, number>;
};

export type HistorySummary = { importedAt: number; firstAt: number | null; lastAt: number | null; plays: number; tracks: number };

type TrackRow = {
  uri: string;
  artist: string;
  title: string;
  plays: number;
  skips: number;
  finishes: number;
  first_at: number | null;
  last_at: number | null;
  months: string;
};

const firstOf = (tracks: HistoryTrack[], pick: (track: HistoryTrack) => number | null, better: (a: number, b: number) => boolean): number | null =>
  tracks.reduce<number | null>((best, track) => {
    const value = pick(track);

    return value !== null && (best === null || better(value, best)) ? value : best;
  }, null);

export const summarize = (tracks: HistoryTrack[], importedAt: number): HistorySummary => ({
  importedAt,
  firstAt: firstOf(tracks, (track) => track.firstAt, (a, b) => a < b),
  lastAt: firstOf(tracks, (track) => track.lastAt, (a, b) => a > b),
  plays: tracks.reduce((sum, track) => sum + track.plays, 0),
  // Songs only ever skipped within seconds are kept for the skip rule but aren't "songs you played".
  tracks: tracks.filter((track) => track.plays > 0).length,
});

// Replaces the person's history in one transaction.
export const saveHistory = (db: Db, userId: string, tracks: HistoryTrack[], importedAt = Date.now()): HistorySummary => {
  const summary = summarize(tracks, importedAt);

  const insert = db.prepare(
    `INSERT INTO history_tracks (user_id, uri, artist, title, plays, skips, finishes, first_at, last_at, months)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');

  try {
    db.prepare('DELETE FROM history_tracks WHERE user_id = ?').run(userId);

    tracks.forEach((track) =>
      insert.run(userId, track.uri, track.artist, track.title, track.plays, track.skips, track.finishes, track.firstAt, track.lastAt, JSON.stringify(track.months)),
    );

    db.prepare(
      `INSERT INTO history_imports (user_id, imported_at, first_at, last_at, plays, tracks) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET imported_at = excluded.imported_at, first_at = excluded.first_at,
         last_at = excluded.last_at, plays = excluded.plays, tracks = excluded.tracks`,
    ).run(userId, summary.importedAt, summary.firstAt, summary.lastAt, summary.plays, summary.tracks);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return summary;
};

export const loadHistory = (db: Db, userId: string): HistoryTrack[] =>
  (db.prepare('SELECT * FROM history_tracks WHERE user_id = ?').all(userId) as TrackRow[]).map((row) => ({
    uri: row.uri,
    artist: row.artist,
    title: row.title,
    plays: row.plays,
    skips: row.skips,
    finishes: row.finishes,
    firstAt: row.first_at,
    lastAt: row.last_at,
    months: JSON.parse(row.months) as Record<string, number>,
  }));

export const historySummary = (db: Db, userId: string): HistorySummary | null => {
  const row = db.prepare('SELECT * FROM history_imports WHERE user_id = ?').get(userId) as
    | { imported_at: number; first_at: number | null; last_at: number | null; plays: number; tracks: number }
    | undefined;

  return row ? { importedAt: row.imported_at, firstAt: row.first_at, lastAt: row.last_at, plays: row.plays, tracks: row.tracks } : null;
};

export const deleteHistory = (db: Db, userId: string): void => {
  db.prepare('DELETE FROM history_tracks WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM history_imports WHERE user_id = ?').run(userId);
};
