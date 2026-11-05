import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { libraryContains, spotifyGetFor } from '../spotify/index.ts';
import { loadProfile, type Known, type TrackInfo } from '../taste/index.ts';
import type { Suggestion, SuggestClient } from './claude.ts';
import { type Discovery, system, userMessage } from './prompt.ts';
import { type Dropped, recentSuggestions, type Run, type RunTrack, saveRun } from './store.ts';
import { verifyAll } from './verify.ts';

// One suggestion run: profile → Claude → look up every song on Spotify → keep up to 25 → save.

// Claude is asked for more than we keep, because some songs won't be found on Spotify (D15).
export const askCount = 35;
export const keepCount = 25;

export type RunInput = { mood: string; discovery: Discovery; refineOf?: Run; note?: string };

type RunDeps = { db: Db; env: Env; claude: SuggestClient; userId: string };

type Selection = { tracks: Omit<RunTrack, 'removed'>[]; dropped: Dropped[] };

// Walks Claude's list in order. Songs Spotify doesn't have, repeats, and (on Adventurous) songs
// by artists you already know are dropped with a reason; songs you know are kept and labelled (D14).
export const selectTracks = (suggestions: Suggestion[], found: (TrackInfo | null)[], known: Known, discovery: Discovery): Selection => {
  const knownUris = new Set(known.trackUris);
  const knownIsrcs = new Set(known.isrcs);
  const knownArtists = new Set(known.artistIds);
  const seen = new Set<string>();
  const selection: Selection = { tracks: [], dropped: [] };

  suggestions.forEach((suggestion, index) => {
    const track = found[index];

    const drop = (reason: Dropped['reason']): void => {
      selection.dropped.push({ artist: suggestion.artist, title: suggestion.title, reason });
    };

    if (!track) return drop('not_found');

    if (seen.has(track.id) || (track.isrc && seen.has(track.isrc))) return drop('duplicate');

    if (discovery === 'adventurous' && track.artists.some((artist) => knownArtists.has(artist.id))) return drop('known_artist');

    if (selection.tracks.length >= keepCount) return;

    seen.add(track.id);

    if (track.isrc) seen.add(track.isrc);

    const isKnown = knownUris.has(track.uri) || Boolean(track.isrc && knownIsrcs.has(track.isrc));

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

export const createRun = async ({ db, env, claude, userId }: RunDeps, input: RunInput): Promise<Run> => {
  const started = Date.now();
  const get = spotifyGetFor(db, env, userId);
  const { profile } = await loadProfile(db, env, userId);
  const previous = input.refineOf?.tracks.map((item) => ({ artist: item.track.artists[0]?.name ?? '', title: item.track.name }));
  const refine = previous && input.note ? { previous, note: input.note } : undefined;

  const user = userMessage({
    profileText: profile.promptText,
    discovery: input.discovery,
    mood: input.mood,
    count: askCount,
    avoid: refine ? [] : recentSuggestions(db, userId),
    refine,
  });

  const answer = await claude.ask({ system, user });
  const wanted = answer.suggestions.map((item) => ({ artist: item.artist, title: item.title, artistAlt: item.artist_alt, titleAlt: item.title_alt }));
  const found = await verifyAll(db, get, wanted);
  const selection = selectTracks(answer.suggestions, found, profile.known, input.discovery);

  await markSaved(get, selection.tracks);

  return saveRun(db, userId, {
    createdAt: started,
    mood: input.mood,
    discovery: input.discovery,
    refinedFrom: input.refineOf?.id ?? null,
    note: input.note ?? null,
    asked: answer.suggestions.length,
    dropped: selection.dropped,
    tracks: selection.tracks.map((item) => ({ ...item, removed: false })),
    usage: answer.usage,
    durationMs: Date.now() - started,
  });
};
