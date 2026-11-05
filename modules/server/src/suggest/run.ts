import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { type Vote, votedSets } from '../feedback/index.ts';
import { getTrack, libraryContains, type SpotifyCall, spotifyFor } from '../spotify/index.ts';
import { loadProfile, type Known, slimTrack, type TasteProfile, type TrackInfo } from '../taste/index.ts';
import type { Suggestion, SuggestClient } from './claude.ts';
import { type Discovery, system, userMessage } from './prompt.ts';
import { type Dropped, recentSuggestions, type Run, type RunTrack, saveRun } from './store.ts';
import { verifyAll } from './verify.ts';

// One suggestion run: profile → Claude → look up every song on Spotify → keep up to 25 → save.

// Claude is asked for more than we keep, because some songs won't be found on Spotify (D15).
export const askCount = 35;
export const keepCount = 25;

// seedTrackId: "More like this" on a song. A rework keeps its parent's seed.
export type RunInput = { mood: string; discovery: Discovery; refineOf?: Run; note?: string; seedTrackId?: string };

type RunDeps = { db: Db; env: Env; claude: SuggestClient; userId: string };

type Selection = { tracks: Omit<RunTrack, 'removed' | 'vote'>[]; dropped: Dropped[] };

// Walks Claude's list in order. Songs Spotify doesn't have, repeats, songs you gave a thumbs down,
// and (on Adventurous) songs by artists you already know are dropped with a reason; songs you know
// (including ones you liked before) are kept and labelled (D14).
export const selectTracks = (
  suggestions: Suggestion[],
  found: (TrackInfo | null)[],
  known: Known,
  discovery: Discovery,
  voted: Record<Vote, Set<string>> = { up: new Set(), down: new Set() },
  seed: TrackInfo | null = null,
): Selection => {
  const knownUris = new Set(known.trackUris);
  const knownIsrcs = new Set(known.isrcs);
  const votedOn = (track: TrackInfo, vote: Vote): boolean => voted[vote].has(track.id) || Boolean(track.isrc && voted[vote].has(track.isrc));
  const knownArtists = new Set(known.artistIds);
  // The seed is already in the list (it goes first), so Claude suggesting it again is a repeat.
  const seen = new Set<string>(seed ? [seed.id, ...(seed.isrc ? [seed.isrc] : [])] : []);
  const selection: Selection = { tracks: [], dropped: [] };

  suggestions.forEach((suggestion, index) => {
    const track = found[index];

    const drop = (reason: Dropped['reason']): void => {
      selection.dropped.push({ artist: suggestion.artist, title: suggestion.title, reason });
    };

    if (!track) return drop('not_found');

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

// The song a run is built around, as a slim track, if any.
const resolveSeed = async (get: SpotifyCall, input: RunInput): Promise<TrackInfo | null> => {
  if (input.refineOf) return input.refineOf.seed;

  return input.seedTrackId ? slimTrack(await getTrack(get, input.seedTrackId)) : null;
};

const promptFor = (db: Db, userId: string, profile: TasteProfile, input: RunInput, seed: TrackInfo | null): string => {
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
    seed: seed ? { artist: seed.artists.map((artist) => artist.name).join(', '), title: seed.name } : undefined,
  });
};

// The seed first, labelled as your pick; Claude's songs after it.
const withSeed = (tracks: Selection['tracks'], seed: TrackInfo | null): Selection['tracks'] =>
  seed
    ? [
        { position: 0, track: seed, reason: 'The song you asked for more of.', kind: 'seed', known: true },
        ...tracks.map((item) => ({ ...item, position: item.position + 1 })),
      ]
    : tracks;

export const createRun = async ({ db, env, claude, userId }: RunDeps, input: RunInput): Promise<Run> => {
  const started = Date.now();
  const get = spotifyFor(db, env, userId);
  const { profile } = await loadProfile(db, env, userId);
  const seed = await resolveSeed(get, input);
  const answer = await claude.ask({ system, user: promptFor(db, userId, profile, input, seed) });
  const wanted = answer.suggestions.map((item) => ({ artist: item.artist, title: item.title, artistAlt: item.artist_alt, titleAlt: item.title_alt }));
  const found = await verifyAll(db, get, wanted);
  const selection = selectTracks(answer.suggestions, found, profile.known, input.discovery, votedSets(db, userId), seed);

  await markSaved(get, selection.tracks);

  return saveRun(db, userId, {
    createdAt: started,
    mood: input.mood,
    discovery: input.discovery,
    refinedFrom: input.refineOf?.id ?? null,
    note: input.note ?? null,
    asked: answer.suggestions.length,
    dropped: selection.dropped,
    tracks: withSeed(selection.tracks, seed),
    usage: answer.usage,
    durationMs: Date.now() - started,
    seed,
  });
};
