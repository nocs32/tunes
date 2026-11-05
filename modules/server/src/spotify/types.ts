// The parts of Spotify's objects Tunes reads. Fields Spotify marked deprecated (genres,
// preview_url) are optional: treat them as possibly missing (spec §5).

export type SpotifyImage = { url: string; width: number | null; height: number | null };

export type SpotifyArtistRef = { id: string; name: string; uri: string };

export type SpotifyArtist = SpotifyArtistRef & {
  genres?: string[];
  images?: SpotifyImage[];
};

export type SpotifyAlbum = { id: string; name: string; images?: SpotifyImage[] };

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: SpotifyArtistRef[];
  album: SpotifyAlbum;
  external_ids?: { isrc?: string };
  is_local?: boolean;
};

export type SpotifyPage<T> = { items: T[]; next: string | null; total: number };

export type SpotifyCursorPage<T> = { items: T[]; next: string | null; cursors: { after?: string | null } | null };

export type SpotifyMe = { id: string; display_name: string | null; images?: SpotifyImage[] };

export type SpotifyPlay = { track: SpotifyTrack; played_at: string };

export type SpotifySavedTrack = { added_at: string; track: SpotifyTrack };

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export const timeRanges: readonly TimeRange[] = ['short_term', 'medium_term', 'long_term'];
