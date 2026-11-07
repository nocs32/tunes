import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { BadRequest } from '../errors.ts';
import { votedSets } from '../feedback/index.ts';
import { type HistoryTrack, loadHistory, rediscoverCandidates } from '../history/index.ts';
import { getTrack, spotifyFor } from '../spotify/index.ts';
import { isRussianSong, looksRussian } from '../suggest/banned.ts';
import type { Pick as ClaudePick, SuggestClient } from '../suggest/claude.ts';
import { type Dropped, type NewRun, type Run, saveRun } from '../suggest/store.ts';
import { mapLimit } from '../suggest/verify.ts';
import { loadProfile, slimTrack, type TrackInfo } from '../taste/index.ts';
import { pickCount, rediscoverMessage, rediscoverSystem } from './prompt.ts';

// Rediscover (D26): Claude picks old favourites from the imported history (many plays, none in the
// last 12 months), in a listening order. The songs come with Spotify ids, so no search is needed;
// each is still looked up, because a song can disappear from Spotify.

export type RediscoverInput = { mood: string; refineOf?: Run; note?: string };

type Deps = { db: Db; env: Env; claude: SuggestClient; userId: string };

const idOf = (track: HistoryTrack): string => track.uri.split(':')[2] ?? '';

// Songs in the last few Rediscover lists sit out, so a new list isn't the same again.
const recentlyRediscovered = (db: Db, userId: string, except?: number): Set<string> => {
  const rows = db
    .prepare(
      `SELECT track FROM run_tracks WHERE run_id IN
         (SELECT id FROM runs WHERE user_id = ? AND discovery = 'rediscover' AND id IS NOT ? ORDER BY id DESC LIMIT 3)`,
    )
    .all(userId, except ?? null) as { track: string }[];

  return new Set(rows.map((row) => (JSON.parse(row.track) as TrackInfo).uri));
};

const candidatesFor = (db: Db, userId: string, input: RediscoverInput): HistoryTrack[] => {
  const disliked = votedSets(db, userId).down;
  const recent = recentlyRediscovered(db, userId, input.refineOf?.id);

  return rediscoverCandidates(
    loadHistory(db, userId),
    (track) => !looksRussian(track.artist) && !looksRussian(track.title) && !disliked.has(idOf(track)) && !recent.has(track.uri),
  );
};

// Claude's numbers → songs from the list, each once, at most two per artist, at most 25.
const chosen = (picks: ClaudePick[], candidates: HistoryTrack[]): { track: HistoryTrack; reason: string }[] => {
  const used = new Set<number>();
  const perArtist = new Map<string, number>();

  return picks.flatMap((pick) => {
    const track = candidates[pick.number - 1];
    const artistCount = track ? (perArtist.get(track.artist) ?? 0) : 0;

    if (!track || used.has(pick.number) || used.size >= pickCount || artistCount >= 2) return [];

    used.add(pick.number);
    perArtist.set(track.artist, artistCount + 1);

    return [{ track, reason: pick.reason }];
  });
};

const lookUp = async (deps: Deps, picks: { track: HistoryTrack; reason: string }[]): Promise<Pick<NewRun, 'tracks' | 'dropped'>> => {
  const get = spotifyFor(deps.db, deps.env, deps.userId);
  const found = await mapLimit(picks, 4, (pick) => getTrack(get, idOf(pick.track)).then(slimTrack, () => null));
  const result: Pick<NewRun, 'tracks' | 'dropped'> = { tracks: [], dropped: [] };

  picks.forEach((pick, index) => {
    const track = found[index];
    const drop = (reason: Dropped['reason']): number => result.dropped.push({ artist: pick.track.artist, title: pick.track.title, reason });

    if (!track) return void drop('not_found');

    if (isRussianSong(track)) return void drop('russian');

    result.tracks.push({ position: result.tracks.length, track, reason: pick.reason, kind: 'old', known: true });
  });

  return result;
};

export const createRediscoverRun = async (deps: Deps, input: RediscoverInput): Promise<Run> => {
  const started = Date.now();
  const candidates = candidatesFor(deps.db, deps.userId, input);

  if (candidates.length === 0) {
    throw new BadRequest('Nothing to rediscover: import your full history on the “Your taste” tab first (songs need 5+ plays and none in the last year).');
  }

  const { profile } = await loadProfile(deps.db, deps.env, deps.userId);
  const previous = input.refineOf?.tracks.map((item) => candidates.find((track) => track.uri === item.track.uri)).filter((track) => track !== undefined);
  const refine = previous && input.note ? { previous, note: input.note } : undefined;
  const answer = await deps.claude.pick({ system: rediscoverSystem, user: rediscoverMessage({ profileText: profile.promptText, mood: input.mood, candidates, refine }) });
  const picks = chosen(answer.picks, candidates);
  const { tracks, dropped } = await lookUp(deps, picks);

  return saveRun(deps.db, deps.userId, {
    createdAt: started,
    mood: input.mood,
    discovery: 'rediscover',
    refinedFrom: input.refineOf?.id ?? null,
    note: input.note ?? null,
    asked: answer.picks.length,
    dropped,
    tracks,
    usage: answer.usage,
    durationMs: Date.now() - started,
    seeds: [],
  });
};
