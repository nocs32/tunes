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

// The calls Tunes makes, on top of a `SpotifyCall` that already carries the user's token.
// Endpoints and limits as checked in spec §5.

export type SpotifyCall = <T>(path: string, init?: RequestInit) => Promise<T>;

export const getMe = (get: SpotifyCall): Promise<SpotifyMe> => get<SpotifyMe>('/me');

export const getTopArtists = async (get: SpotifyCall, range: TimeRange): Promise<SpotifyArtist[]> =>
  (await get<SpotifyPage<SpotifyArtist>>(`/me/top/artists?time_range=${range}&limit=50`)).items;

export const getTopTracks = async (get: SpotifyCall, range: TimeRange): Promise<SpotifyTrack[]> =>
  (await get<SpotifyPage<SpotifyTrack>>(`/me/top/tracks?time_range=${range}&limit=50`)).items;

// Spotify only keeps the last 50 plays available.
export const getRecentlyPlayed = async (get: SpotifyCall): Promise<SpotifyPlay[]> =>
  (await get<SpotifyCursorPage<SpotifyPlay>>('/me/player/recently-played?limit=50')).items;

// Saved tracks, newest first, 50 per page. Capped so a huge library can't eat the quota;
// `total` still says how many there are.
export const savedTracksCap = 2000;

export const getSavedTracks = async (get: SpotifyCall): Promise<{ items: SpotifySavedTrack[]; total: number }> => {
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

// One track by id (the single-track endpoint is still available; batch ?ids= lookups are gone).
export const getTrack = (get: SpotifyCall, id: string): Promise<SpotifyTrack> => get<SpotifyTrack>(`/tracks/${encodeURIComponent(id)}`);

// Track search: at most 10 results per request (spec §5).
export const searchTracks = async (get: SpotifyCall, query: string): Promise<SpotifyTrack[]> =>
  (await get<{ tracks: SpotifyPage<SpotifyTrack> }>(`/search?type=track&limit=10&q=${encodeURIComponent(query)}`)).tracks.items;

// Which of these tracks are saved in the library: at most 40 URIs per request.
export const libraryContains = async (get: SpotifyCall, uris: string[]): Promise<boolean[]> => {
  const chunks = Array.from({ length: Math.ceil(uris.length / 40) }, (_, index) => uris.slice(index * 40, index * 40 + 40));
  const answers = await Promise.all(chunks.map((chunk) => get<boolean[]>(`/me/library/contains?uris=${encodeURIComponent(chunk.join(','))}`)));

  return answers.flat();
};

type FollowedPage = { artists: SpotifyCursorPage<SpotifyArtist> };

export const getFollowedArtists = async (get: SpotifyCall): Promise<SpotifyArtist[]> => {
  const artists: SpotifyArtist[] = [];
  let next: string | null = '/me/following?type=artist&limit=50';

  while (next) {
    const page: FollowedPage = await get(next);

    artists.push(...page.artists.items);
    next = page.artists.next;
  }

  return artists;
};

// Playlists (spec §5): created with POST /me/playlists; contents live at /playlists/{id}/items.
export type SpotifyPlaylist = { id: string; name: string; external_urls?: { spotify?: string } };

type PlaylistDetails = { name: string; description: string };

const jsonBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// Asks for a private playlist; Spotify currently ignores that (see playlist/index.ts).
export const createPlaylist = (call: SpotifyCall, details: PlaylistDetails): Promise<SpotifyPlaylist> =>
  call<SpotifyPlaylist>('/me/playlists', jsonBody('POST', { ...details, public: false }));

// `public: false` as documented, though Spotify currently ignores it (see playlist/index.ts).
export const updatePlaylistDetails = (call: SpotifyCall, id: string, details: PlaylistDetails): Promise<void> =>
  call<void>(`/playlists/${id}`, jsonBody('PUT', { ...details, public: false }));

// Replaces everything in the playlist (max 100 URIs per request; a run has at most 25).
export const replacePlaylistItems = (call: SpotifyCall, id: string, uris: string[]): Promise<void> =>
  call<void>(`/playlists/${id}/items`, jsonBody('PUT', { uris }));

export const addPlaylistItems = (call: SpotifyCall, id: string, uris: string[]): Promise<void> =>
  call<void>(`/playlists/${id}/items`, jsonBody('POST', { uris }));
