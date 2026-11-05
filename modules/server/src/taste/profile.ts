import { type TimeRange, timeRanges } from '../spotify/types.ts';
import type { ArtistInfo, RawTaste, TrackInfo } from './collect.ts';
import { promptText } from './prompt-text.ts';

// Turns the raw Spotify data into a compact profile: who you listen to and how that's
// changing, a handful of representative tracks, and the sets of things you already know.

// rising: in your last-4-weeks list but not your 1-year list.
// older: only in your 1-year list (not the last 4 weeks or 6 months).
export type Trend = 'rising' | 'steady' | 'older';

export type ProfileArtist = ArtistInfo & { ranks: Partial<Record<TimeRange, number>>; trend: Trend };

export type Known = { trackUris: string[]; isrcs: string[]; artistIds: string[] };

export type TasteProfile = {
  artists: ProfileArtist[];
  tracks: TrackInfo[];
  recentArtists: { name: string; plays: number }[];
  genres: { name: string; count: number }[];
  counts: { saved: number; savedLoaded: number; followed: number; recentPlays: number };
  promptText: string;
  known: Known;
};

export const profileArtistCount = 30;
export const profileTrackCount = 40;

const trendOf = (ranks: Partial<Record<TimeRange, number>>): Trend => {
  if (ranks.short_term && !ranks.long_term) return 'rising';

  if (ranks.long_term && !ranks.short_term && !ranks.medium_term) return 'older';

  return 'steady';
};

// Each list contributes (51 − rank), so #1 everywhere scores highest and one-list artists still count.
const score = (ranks: Partial<Record<TimeRange, number>>): number =>
  Object.values(ranks).reduce((sum, rank) => sum + (51 - rank), 0);

export const rankArtists = (top: RawTaste['topArtists']): ProfileArtist[] => {
  const byId = new Map<string, ProfileArtist>();

  timeRanges.forEach((range) =>
    top[range].forEach((artist, index) => {
      const entry = byId.get(artist.id) ?? { ...artist, ranks: {}, trend: 'steady' };

      entry.ranks[range] = index + 1;
      byId.set(artist.id, entry);
    }),
  );

  return [...byId.values()]
    .map((artist) => ({ ...artist, trend: trendOf(artist.ranks) }))
    .sort((a, b) => score(b.ranks) - score(a.ranks));
};

// Takes turns between the three lists (1st of each, then 2nd of each…) so recent and
// long-time favourites are both represented.
export const representativeTracks = (top: RawTaste['topTracks'], limit = profileTrackCount): TrackInfo[] => {
  const picked = new Map<string, TrackInfo>();
  const longest = Math.max(...timeRanges.map((range) => top[range].length));

  for (let index = 0; index < longest && picked.size < limit; index++) {
    timeRanges.forEach((range) => {
      const track = top[range][index];

      if (track && !picked.has(track.id) && picked.size < limit) picked.set(track.id, track);
    });
  }

  return [...picked.values()];
};

const countBy = (names: string[]): { name: string; count: number }[] => {
  const counts = new Map<string, number>();

  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));

  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
};

export const knownSets = (raw: RawTaste): Known => {
  const tracks = [...timeRanges.flatMap((range) => raw.topTracks[range]), ...raw.recent.map((play) => play.track), ...raw.saved];

  const artistIds = [
    ...timeRanges.flatMap((range) => raw.topArtists[range].map((artist) => artist.id)),
    ...raw.followed.map((artist) => artist.id),
    ...tracks.flatMap((track) => track.artists.map((artist) => artist.id)),
  ];

  return {
    trackUris: [...new Set(tracks.map((track) => track.uri))],
    isrcs: [...new Set(tracks.flatMap((track) => (track.isrc ? [track.isrc] : [])))],
    artistIds: [...new Set(artistIds)],
  };
};

export const buildProfile = (raw: RawTaste): TasteProfile => {
  const artists = rankArtists(raw.topArtists).slice(0, profileArtistCount);
  const tracks = representativeTracks(raw.topTracks);

  const recentArtists = countBy(raw.recent.map((play) => play.track.artists[0]?.name ?? 'Unknown'))
    .slice(0, 10)
    .map(({ name, count }) => ({ name, plays: count }));

  const genres = countBy(artists.flatMap((artist) => artist.genres)).slice(0, 15);
  const counts = { saved: raw.savedTotal, savedLoaded: raw.saved.length, followed: raw.followed.length, recentPlays: raw.recent.length };
  const profile = { artists, tracks, recentArtists, genres, counts, known: knownSets(raw) };

  return { ...profile, promptText: promptText(profile) };
};
