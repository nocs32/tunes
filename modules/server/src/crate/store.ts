import type { Db } from '../db/index.ts';
import type { TrackInfo } from '../taste/collect.ts';

// The crate: songs someone collected from mixes and their top tracks, for a "Find more like
// these" mix. It stays until they clear it, so they can dig from the same crate again.

export const crateLimit = 10;

export const getCrate = (db: Db, userId: string): TrackInfo[] =>
  (db.prepare('SELECT track FROM crate WHERE user_id = ? ORDER BY added_at, rowid').all(userId) as { track: string }[]).map(
    (row) => JSON.parse(row.track) as TrackInfo,
  );

export const addToCrate = (db: Db, userId: string, track: TrackInfo): void => {
  db.prepare('INSERT OR IGNORE INTO crate (user_id, track_id, track, added_at) VALUES (?, ?, ?, ?)').run(
    userId,
    track.id,
    JSON.stringify(track),
    Date.now(),
  );
};

export const removeFromCrate = (db: Db, userId: string, trackId: string): void => {
  db.prepare('DELETE FROM crate WHERE user_id = ? AND track_id = ?').run(userId, trackId);
};

export const clearCrate = (db: Db, userId: string): void => {
  db.prepare('DELETE FROM crate WHERE user_id = ?').run(userId);
};
