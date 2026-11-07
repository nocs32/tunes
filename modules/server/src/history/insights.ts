import { normalize } from '../suggest/match.ts';
import type { HistoryTrack } from './store.ts';

// What Tunes reads out of the imported history (D26):
// - what Claude reads: the last 12 months lead ("lately" = last 3), older years are one line each,
//   marked as past phases (the user's taste turns over almost completely every year);
// - songs skipped 3+ times and never played to the end, which count like a thumbs down;
// - old favourites for Rediscover: many plays, none in the last 12 months.

export const skipLimit = 3;

export const isSkipped = (track: HistoryTrack): boolean => track.skips >= skipLimit && track.finishes === 0;

export const monthKey = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

// The month `count` months before the one `ms` falls in, as "2026-03".
const monthsBefore = (ms: number, count: number): string => {
  const date = new Date(ms);

  return monthKey(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - count, 1));
};

// "2026-03" → "03/2026", in the user's date order.
const monthLabel = (key: string): string => `${key.slice(5)}/${key.slice(0, 4)}`;

type Window = { from: string; to: string };

export const topArtists = (tracks: HistoryTrack[], { from, to }: Window, limit: number): { name: string; plays: number }[] => {
  const plays = new Map<string, number>();

  tracks.forEach((track) => {
    const inWindow = Object.entries(track.months).reduce((sum, [month, count]) => (month >= from && month <= to ? sum + count : sum), 0);

    if (inWindow) plays.set(track.artist, (plays.get(track.artist) ?? 0) + inWindow);
  });

  return [...plays].map(([name, count]) => ({ name, plays: count })).sort((a, b) => b.plays - a.plays).slice(0, limit);
};

const firstMonth = (tracks: HistoryTrack[]): string | null =>
  tracks.reduce<string | null>((first, track) => Object.keys(track.months).reduce((min, month) => (min === null || month < min ? month : min), first), null);

// One line per earlier year, newest first, until the history runs out.
const earlierPhases = (tracks: HistoryTrack[], now: number): string[] => {
  const oldest = firstMonth(tracks);
  const lines: string[] = [];

  for (let year = 1; oldest && monthsBefore(now, year * 12) >= oldest; year++) {
    const window = { from: monthsBefore(now, year * 12 + 11), to: monthsBefore(now, year * 12) };
    const names = topArtists(tracks, window, 8).map((artist) => artist.name);
    const from = window.from < oldest ? oldest : window.from;

    if (names.length) lines.push(`- ${monthLabel(from)} to ${monthLabel(window.to)}: ${names.join(', ')}`);
  }

  return lines;
};

const withPlays = (artists: { name: string; plays: number }[]): string => artists.map((artist) => `${artist.name} ×${artist.plays}`).join(', ');

const skippedLines = (tracks: HistoryTrack[]): string[] =>
  tracks
    .filter(isSkipped)
    .sort((a, b) => b.skips - a.skips)
    .slice(0, 30)
    .map((track) => `- ${track.artist} — ${track.title}`);

// The history section of what Claude reads, or null without an import.
export const historyText = (tracks: HistoryTrack[], now = Date.now()): string | null => {
  const oldest = firstMonth(tracks);

  if (!oldest) return null;

  const current = monthKey(now);
  const lastYear = topArtists(tracks, { from: monthsBefore(now, 11), to: current }, 30);
  const lately = topArtists(tracks, { from: monthsBefore(now, 2), to: current }, 15);
  const earlier = earlierPhases(tracks, now);
  const skipped = skippedLines(tracks);

  return [
    `FULL LISTENING HISTORY (their Spotify data export, ${monthLabel(oldest)} on; plays of 30 seconds or more)`,
    'Their taste turns over almost completely from year to year. The last 12 months are who they are now: weigh them far above anything older.',
    ...(lastYear.length ? [`LAST 12 MONTHS, most-played artists: ${withPlays(lastYear)}`] : []),
    ...(lately.length ? [`LATELY (last 3 months): ${withPlays(lately)}`] : []),
    ...(earlier.length ? ['EARLIER PHASES (context only; don’t steer toward them unless the request asks for it):', ...earlier] : []),
    ...(skipped.length ? [`SONGS THEY KEEP SKIPPING (${skipLimit}+ skips, never played to the end; count these like a thumbs down):`, ...skipped] : []),
  ].join('\n');
};

// artistNames are normalized (suggest/match.ts): the export has artist names, not ids.
export type HistoryFilters = { trackUris: Set<string>; artistNames: Set<string>; skippedIds: Set<string> };

export const noHistory: HistoryFilters = { trackUris: new Set(), artistNames: new Set(), skippedIds: new Set() };

export const historyFilters = (tracks: HistoryTrack[]): HistoryFilters => ({
  trackUris: new Set(tracks.filter((track) => track.plays > 0).map((track) => track.uri)),
  artistNames: new Set(tracks.filter((track) => track.plays > 0).map((track) => normalize(track.artist))),
  skippedIds: new Set(tracks.filter(isSkipped).map((track) => track.uri.split(':')[2] ?? '')),
});

const yearMs = 365 * 24 * 60 * 60 * 1000;

export const rediscoverMinPlays = 5;

// Old favourites: at least 5 plays, none in the last 12 months, most played first.
export const rediscoverCandidates = (tracks: HistoryTrack[], keep: (track: HistoryTrack) => boolean, now = Date.now(), limit = 150): HistoryTrack[] =>
  tracks
    .filter((track) => track.plays >= rediscoverMinPlays && track.lastAt !== null && now - track.lastAt >= yearMs && !isSkipped(track) && keep(track))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
