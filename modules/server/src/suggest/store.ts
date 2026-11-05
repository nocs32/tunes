import type { Db } from '../db/index.ts';
import type { TrackInfo } from '../taste/collect.ts';
import type { Discovery } from './prompt.ts';

export type RunTrack = {
  position: number;
  track: TrackInfo;
  reason: string;
  kind: 'close' | 'wildcard';
  known: boolean;
  removed: boolean;
};

// Why a suggestion isn't in the list.
export type DropReason = 'not_found' | 'duplicate' | 'known_artist';

export type Dropped = { artist: string; title: string; reason: DropReason };

export type Run = {
  id: number;
  createdAt: number;
  mood: string;
  discovery: Discovery;
  refinedFrom: number | null;
  note: string | null;
  asked: number;
  dropped: Dropped[];
  tracks: RunTrack[];
  usage: { input: number; output: number } | null;
  durationMs: number | null;
};

type RunRow = {
  id: number;
  created_at: number;
  mood: string;
  discovery: Discovery;
  refined_from: number | null;
  note: string | null;
  asked: number;
  dropped: string;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
};

type TrackRow = { position: number; track: string; reason: string; kind: 'close' | 'wildcard'; known: number; removed: number };

const tracksOf = (db: Db, runId: number): RunTrack[] =>
  (db.prepare('SELECT * FROM run_tracks WHERE run_id = ? ORDER BY position').all(runId) as TrackRow[]).map((row) => ({
    position: row.position,
    track: JSON.parse(row.track) as TrackInfo,
    reason: row.reason,
    kind: row.kind,
    known: row.known === 1,
    removed: row.removed === 1,
  }));

const fromRow = (db: Db, row: RunRow): Run => ({
  id: row.id,
  createdAt: row.created_at,
  mood: row.mood,
  discovery: row.discovery,
  refinedFrom: row.refined_from,
  note: row.note,
  asked: row.asked,
  dropped: JSON.parse(row.dropped) as Dropped[],
  tracks: tracksOf(db, row.id),
  usage: row.input_tokens === null ? null : { input: row.input_tokens, output: row.output_tokens ?? 0 },
  durationMs: row.duration_ms,
});

// Only the owner's runs: another user's id reads as "not found".
export const getRun = (db: Db, userId: string, id: number): Run | undefined => {
  const row = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(id, userId) as RunRow | undefined;

  return row && fromRow(db, row);
};

export const latestRun = (db: Db, userId: string): Run | undefined => {
  const row = db.prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as RunRow | undefined;

  return row && fromRow(db, row);
};

// Songs from the last few runs, so Claude doesn't repeat itself.
export const recentSuggestions = (db: Db, userId: string, runs = 3): { artist: string; title: string }[] => {
  const rows = db
    .prepare(
      `SELECT track FROM run_tracks WHERE run_id IN (SELECT id FROM runs WHERE user_id = ? ORDER BY id DESC LIMIT ?)`,
    )
    .all(userId, runs) as { track: string }[];

  return rows.map((row) => {
    const track = JSON.parse(row.track) as TrackInfo;

    return { artist: track.artists[0]?.name ?? '', title: track.name };
  });
};

export const saveRun = (db: Db, userId: string, run: Omit<Run, 'id'>): Run => {
  const result = db
    .prepare(
      `INSERT INTO runs (user_id, created_at, mood, discovery, refined_from, note, asked, dropped, input_tokens, output_tokens, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, run.createdAt, run.mood, run.discovery, run.refinedFrom, run.note, run.asked, JSON.stringify(run.dropped),
      run.usage?.input ?? null, run.usage?.output ?? null, run.durationMs);

  const id = Number(result.lastInsertRowid);
  const insert = db.prepare('INSERT INTO run_tracks (run_id, position, track, reason, kind, known, removed) VALUES (?, ?, ?, ?, ?, ?, 0)');

  run.tracks.forEach((item) => insert.run(id, item.position, JSON.stringify(item.track), item.reason, item.kind, item.known ? 1 : 0));

  return getRun(db, userId, id) as Run;
};

export const setRemoved = (db: Db, runId: number, position: number, removed: boolean): void => {
  db.prepare('UPDATE run_tracks SET removed = ? WHERE run_id = ? AND position = ?').run(removed ? 1 : 0, runId, position);
};
