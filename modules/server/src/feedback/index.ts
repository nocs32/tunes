import type { Db } from '../db/index.ts';
import type { TrackInfo } from '../taste/collect.ts';

// Thumbs up / down on suggested songs (M4). Votes feed the next runs three ways:
// - Claude reads the latest ones in the profile text (strongest signal, see prompt.ts);
// - a disliked song is never shown again (dropped with reason "disliked");
// - a liked song suggested again is labelled "You know this".

export type Vote = 'up' | 'down';

type FeedbackRow = { track_id: string; isrc: string | null; artist: string; title: string; vote: Vote };

// How many recent votes of each kind Claude sees.
export const feedbackShown = 40;

// `null` takes the vote back.
export const setVote = (db: Db, userId: string, track: TrackInfo, vote: Vote | null, runId: number): void => {
  if (!vote) {
    db.prepare('DELETE FROM feedback WHERE user_id = ? AND track_id = ?').run(userId, track.id);

    return;
  }

  db.prepare(
    `INSERT INTO feedback (user_id, track_id, isrc, artist, title, vote, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, track_id) DO UPDATE SET vote = excluded.vote, run_id = excluded.run_id, created_at = excluded.created_at`,
  ).run(userId, track.id, track.isrc, track.artists.map((artist) => artist.name).join(', '), track.name, vote, runId, Date.now());
};

// track id → vote, for showing a run's thumbs.
export const votesByTrack = (db: Db, userId: string): Map<string, Vote> => {
  const rows = db.prepare('SELECT track_id, vote FROM feedback WHERE user_id = ?').all(userId) as Pick<FeedbackRow, 'track_id' | 'vote'>[];

  return new Map(rows.map((row) => [row.track_id, row.vote]));
};

// Track ids and ISRCs per vote, for filtering a new run.
export const votedSets = (db: Db, userId: string): Record<Vote, Set<string>> => {
  const sets: Record<Vote, Set<string>> = { up: new Set(), down: new Set() };

  (db.prepare('SELECT track_id, isrc, vote FROM feedback WHERE user_id = ?').all(userId) as FeedbackRow[]).forEach((row) => {
    sets[row.vote].add(row.track_id);

    if (row.isrc) sets[row.vote].add(row.isrc);
  });

  return sets;
};

const recent = (db: Db, userId: string, vote: Vote): FeedbackRow[] =>
  db
    .prepare('SELECT * FROM feedback WHERE user_id = ? AND vote = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, vote, feedbackShown) as FeedbackRow[];

const lines = (rows: FeedbackRow[]): string => rows.map((row) => `- ${row.artist} — ${row.title}`).join('\n');

// The part of the profile text Claude reads about votes; empty until there are some.
export const feedbackText = (db: Db, userId: string): string => {
  const liked = recent(db, userId, 'up');
  const disliked = recent(db, userId, 'down');

  if (liked.length === 0 && disliked.length === 0) return '';

  const parts = ['FEEDBACK ON EARLIER SUGGESTIONS (their own thumbs, most recent first)'];

  if (liked.length) parts.push(`Liked:\n${lines(liked)}`);

  if (disliked.length) parts.push(`Disliked:\n${lines(disliked)}`);

  return parts.join('\n');
};
