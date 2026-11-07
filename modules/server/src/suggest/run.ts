import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { type Vote, votedSets } from '../feedback/index.ts';
import { getCrate } from '../crate/store.ts';
import { getTrack, libraryContains, type SpotifyCall, spotifyFor } from '../spotify/index.ts';
import { loadProfile, type Known, slimTrack, type TasteProfile, type TrackInfo } from '../taste/index.ts';
import { isRussianSong } from './banned.ts';
import type { Suggestion, SuggestClient } from './claude.ts';
import { type Discovery, system, userMessage } from './prompt.ts';
import { type Dropped, recentSuggestions, type Run, type RunTrack, saveRun } from './store.ts';
import { verifyAll } from './verify.ts';

// One suggestion run: profile → Claude → look up every song on Spotify → keep up to 25 → save.

// Claude is asked for more than we keep, because some songs won't be found on Spotify (D15).
export const askCount = 35;
export const keepCount = 25;

// seedTrackIds: "More like this" on a song, or the crate's songs. A rework keeps its parent's seeds.
export type RunInput = { mood: string; discovery: Discovery; refineOf?: Run; note?: string; seedTrackIds?: string[] };

type RunDeps = { db: Db; env: Env; claude: SuggestClient; userId: string };

type Selection = { tracks: Omit<RunTrack, 'removed' | 'vote'>[]; dropped: Dropped[] };

// Walks Claude's list in order. Songs Spotify doesn't have, Russian songs (D25), repeats, songs you gave a thumbs down,
// and (on Adventurous) songs by artists you already know are dropped with a reason; songs you know
// (including ones you liked before) are kept and labelled (D14).
export const selectTracks = (
  suggestions: Suggestion[],
  found: (TrackInfo | null)[],
  known: Known,
  discovery: Discovery,
  voted: Record<Vote, Set<string>> = { up: new Set(), down: new Set() },
  seeds: TrackInfo[] = [],
): Selection => {
  const knownUris = new Set(known.trackUris);
  const knownIsrcs = new Set(known.isrcs);
  const votedOn = (track: TrackInfo, vote: Vote): boolean => voted[vote].has(track.id) || Boolean(track.isrc && voted[vote].has(track.isrc));
  const knownArtists = new Set(known.artistIds);
  // The seeds are already in the list (they go first), so Claude suggesting one again is a repeat.
  const seen = new Set<string>(seeds.flatMap((seed) => [seed.id, ...(seed.isrc ? [seed.isrc] : [])]));
  const selection: Selection = { tracks: [], dropped: [] };

  suggestions.forEach((suggestion, index) => {
    const track = found[index];

    const drop = (reason: Dropped['reason']): void => {
      selection.dropped.push({ artist: suggestion.artist, title: suggestion.title, reason });
    };

    if (!track) return drop('not_found');

    if (isRussianSong(track)) return drop('russian');

    if (seen.has(track.id) || (track.isrc && seen.has(track.isrc))) return drop('duplicate');

    if (votedOn(track, 'down')) return drop('disliked');

    if (discovery === 'adventurous' && track.artists.some((artist) => knownArtists.has(artist.id))) return drop('known_artist');

    if (selection.tracks.length >= keepCount) return;

    seen.add(track.id);

    if (track.isrc) seen.add(track.isrc);

    const isKnown = knownUris.has(track.uri) || Boolean(track.isrc && knownIsrcs.has(track.isrc)) || votedOn(track, 'up');

    selection.tracks.push({ position: selection.tracks.length, track, reason: suggestion.reason, kind: suggestion.kind, known: isKnown });
  });

  return selection;
};

// Saved tracks beyond the profile's 2,000 cap still count as known. A failed check isn't worth failing the run for.
const markSaved = async (get: Parameters<typeof libraryContains>[0], tracks: Selection['tracks']): Promise<void> => {
  const saved = await libraryContains(get, tracks.map((item) => item.track.uri)).catch(() => []);

  tracks.forEach((item, index) => {
    if (saved[index]) item.known = true;
  });
};

// The songs a run is built around: from the crate when they're in it, otherwise looked up on Spotify.
const resolveSeeds = async (db: Db, get: SpotifyCall, userId: string, input: RunInput): Promise<TrackInfo[]> => {
  if (input.refineOf) return input.refineOf.seeds;

  const crate = new Map(getCrate(db, userId).map((track) => [track.id, track]));
  const ids = [...new Set(input.seedTrackIds ?? [])];

  return Promise.all(ids.map(async (id) => crate.get(id) ?? slimTrack(await getTrack(get, id))));
};

const promptFor = (db: Db, userId: string, profile: TasteProfile, input: RunInput, seeds: TrackInfo[]): string => {
  const previous = input.refineOf?.tracks
    .filter((item) => item.kind !== 'seed')
    .map((item) => ({ artist: item.track.artists[0]?.name ?? '', title: item.track.name }));

  const refine = previous && input.note ? { previous, note: input.note } : undefined;

  return userMessage({
    profileText: profile.promptText,
    discovery: input.discovery,
    mood: input.mood,
    count: askCount,
    avoid: refine ? [] : recentSuggestions(db, userId),
    refine,
    seeds: seeds.map((seed) => ({ artist: seed.artists.map((artist) => artist.name).join(', '), title: seed.name })),
  });
};

// The seeds first, labelled as your picks; Claude's songs after them.
const withSeeds = (tracks: Selection['tracks'], seeds: TrackInfo[]): Selection['tracks'] => [
  ...seeds.map((track, position) => ({
    position,
    track,
    reason: seeds.length === 1 ? 'The song you asked for more of.' : 'One of the songs you asked for more of.',
    kind: 'seed' as const,
    known: true,
  })),
  ...tracks.map((item) => ({ ...item, position: item.position + seeds.length })),
];

export const createRun = async ({ db, env, claude, userId }: RunDeps, input: RunInput): Promise<Run> => {
  const started = Date.now();
  const get = spotifyFor(db, env, userId);
  const { profile } = await loadProfile(db, env, userId);
  const seeds = await resolveSeeds(db, get, userId, input);
  const answer = await claude.ask({ system, user: promptFor(db, userId, profile, input, seeds) });
  const wanted = answer.suggestions.map((item) => ({ artist: item.artist, title: item.title, artistAlt: item.artist_alt, titleAlt: item.title_alt }));
  const found = await verifyAll(db, get, wanted);
  const selection = selectTracks(answer.suggestions, found, profile.known, input.discovery, votedSets(db, userId), seeds);

  await markSaved(get, selection.tracks);

  return saveRun(db, userId, {
    createdAt: started,
    mood: input.mood,
    discovery: input.discovery,
    refinedFrom: input.refineOf?.id ?? null,
    note: input.note ?? null,
    asked: answer.suggestions.length,
    dropped: selection.dropped,
    tracks: withSeeds(selection.tracks, seeds),
    usage: answer.usage,
    durationMs: Date.now() - started,
    seeds,
  });
};
