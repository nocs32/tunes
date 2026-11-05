import type { Db } from '../db/index.ts';
import { type Vote, votesByTrack } from '../feedback/index.ts';
import type { TrackInfo } from '../taste/collect.ts';
import type { Discovery } from './prompt.ts';

export type RunTrack = {
  position: number;
  track: TrackInfo;
  reason: string;
  kind: 'close' | 'wildcard';
  known: boolean;
  removed: boolean;
  vote: Vote | null;
};

// Why a suggestion isn't in the list.
export type DropReason = 'not_found' | 'duplicate' | 'known_artist' | 'disliked';

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
  playlist: SentTo | null;
};

// Where the run's songs went in Spotify, and when.
export type SentTo = { id: string; name: string; sentAt: number };

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
  playlist_id: string | null;
  playlist_name: string | null;
  sent_at: number | null;
};

type TrackRow = { position: number; track: string; reason: string; kind: 'close' | 'wildcard'; known: number; removed: number };

const tracksOf = (db: Db, userId: string, runId: number): RunTrack[] => {
  const votes = votesByTrack(db, userId);

  return (db.prepare('SELECT * FROM run_tracks WHERE run_id = ? ORDER BY position').all(runId) as TrackRow[]).map((row) => {
    const track = JSON.parse(row.track) as TrackInfo;

    return {
      position: row.position,
      track,
      reason: row.reason,
      kind: row.kind,
      known: row.known === 1,
      removed: row.removed === 1,
      vote: votes.get(track.id) ?? null,
    };
  });
};

const fromRow = (db: Db, userId: string, row: RunRow): Run => ({
  id: row.id,
  createdAt: row.created_at,
  mood: row.mood,
  discovery: row.discovery,
  refinedFrom: row.refined_from,
  note: row.note,
  asked: row.asked,
  dropped: JSON.parse(row.dropped) as Dropped[],
  tracks: tracksOf(db, userId, row.id),
  usage: row.input_tokens === null ? null : { input: row.input_tokens, output: row.output_tokens ?? 0 },
  durationMs: row.duration_ms,
  playlist: row.playlist_id ? { id: row.playlist_id, name: row.playlist_name ?? '', sentAt: row.sent_at ?? 0 } : null,
});

// Only the owner's runs: another user's id reads as "not found".
export const getRun = (db: Db, userId: string, id: number): Run | undefined => {
  const row = db.prepare('SELECT * FROM runs WHERE id = ? AND user_id = ?').get(id, userId) as RunRow | undefined;

  return row && fromRow(db, userId, row);
};

export const latestRun = (db: Db, userId: string): Run | undefined => {
  const row = db.prepare('SELECT * FROM runs WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as RunRow | undefined;

  return row && fromRow(db, userId, row);
};

// Earlier runs, newest first, as a short list (the page opens one with getRun).
export type RunSummary = Pick<Run, 'id' | 'createdAt' | 'mood' | 'discovery' | 'note' | 'playlist'> & { songs: number };

type SummaryRow = Pick<RunRow, 'id' | 'created_at' | 'mood' | 'discovery' | 'note' | 'playlist_id' | 'playlist_name' | 'sent_at'> & {
  songs: number;
};

export const listRuns = (db: Db, userId: string, limit = 30): RunSummary[] =>
  (
    db
      .prepare(
        `SELECT runs.*, (SELECT COUNT(*) FROM run_tracks WHERE run_id = runs.id AND removed = 0) AS songs
         FROM runs WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(userId, limit) as SummaryRow[]
  ).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    mood: row.mood,
    discovery: row.discovery,
    note: row.note,
    songs: row.songs,
    playlist: row.playlist_id ? { id: row.playlist_id, name: row.playlist_name ?? '', sentAt: row.sent_at ?? 0 } : null,
  }));

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

export type NewRun = Omit<Run, 'id' | 'playlist' | 'tracks'> & { tracks: Omit<RunTrack, 'vote' | 'removed'>[] };

export const saveRun = (db: Db, userId: string, run: NewRun): Run => {
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

export const markSent = (db: Db, runId: number, sent: SentTo): void => {
  db.prepare('UPDATE runs SET playlist_id = ?, playlist_name = ?, sent_at = ? WHERE id = ?').run(sent.id, sent.name, sent.sentAt, runId);
};
