import type {
  SpotifyArtist,
  SpotifyCursorPage,
  SpotifyMe,
  SpotifyPage,
  SpotifyPlay,
  SpotifySavedTrack,
  SpotifyTrack,
  TimeRange,
} from './types.ts';

// The calls Tunes makes, on top of a `SpotifyGet` that already carries the user's token.
// Endpoints and limits as checked in spec §5.

export type SpotifyGet = <T>(path: string) => Promise<T>;

export const getMe = (get: SpotifyGet): Promise<SpotifyMe> => get<SpotifyMe>('/me');

export const getTopArtists = async (get: SpotifyGet, range: TimeRange): Promise<SpotifyArtist[]> =>
  (await get<SpotifyPage<SpotifyArtist>>(`/me/top/artists?time_range=${range}&limit=50`)).items;

export const getTopTracks = async (get: SpotifyGet, range: TimeRange): Promise<SpotifyTrack[]> =>
  (await get<SpotifyPage<SpotifyTrack>>(`/me/top/tracks?time_range=${range}&limit=50`)).items;

// Spotify only keeps the last 50 plays available.
export const getRecentlyPlayed = async (get: SpotifyGet): Promise<SpotifyPlay[]> =>
  (await get<SpotifyCursorPage<SpotifyPlay>>('/me/player/recently-played?limit=50')).items;

// Saved tracks, newest first, 50 per page. Capped so a huge library can't eat the quota;
// `total` still says how many there are.
export const savedTracksCap = 2000;

export const getSavedTracks = async (get: SpotifyGet): Promise<{ items: SpotifySavedTrack[]; total: number }> => {
  const items: SpotifySavedTrack[] = [];
  let next: string | null = '/me/tracks?limit=50';
  let total = 0;

  while (next && items.length < savedTracksCap) {
    const page: SpotifyPage<SpotifySavedTrack> = await get(next);

    items.push(...page.items);
    total = page.total;
    next = page.next;
  }

  return { items, total };
};

type FollowedPage = { artists: SpotifyCursorPage<SpotifyArtist> };

export const getFollowedArtists = async (get: SpotifyGet): Promise<SpotifyArtist[]> => {
  const artists: SpotifyArtist[] = [];
  let next: string | null = '/me/following?type=artist&limit=50';

  while (next) {
    const page: FollowedPage = await get(next);

    artists.push(...page.artists.items);
    next = page.artists.next;
  }

  return artists;
};
