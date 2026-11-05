import {
  getFollowedArtists,
  getRecentlyPlayed,
  getSavedTracks,
  getTopArtists,
  getTopTracks,
  type SpotifyArtist,
  type SpotifyGet,
  type SpotifyTrack,
  type TimeRange,
  timeRanges,
} from '../spotify/index.ts';

// Everything Spotify tells us about a listener, slimmed to the fields Tunes uses
// (the cache stays small, and nothing else leaks into the profile).

export type ArtistRef = { id: string; name: string };

export type ArtistInfo = ArtistRef & { genres: string[]; imageUrl: string | null };

export type TrackInfo = {
  id: string;
  uri: string;
  name: string;
  artists: ArtistRef[];
  album: string;
  imageUrl: string | null;
  isrc: string | null;
};

export type RawTaste = {
  topArtists: Record<TimeRange, ArtistInfo[]>;
  topTracks: Record<TimeRange, TrackInfo[]>;
  recent: { track: TrackInfo; playedAt: string }[];
  saved: TrackInfo[];
  savedTotal: number;
  followed: ArtistInfo[];
};

// Spotify lists images largest first; the smallest one that is still ≥ 160 px is plenty.
const pickImage = (images: { url: string; width: number | null }[] | undefined): string | null => {
  const usable = (images ?? []).filter((image) => (image.width ?? 640) >= 160);

  return usable.at(-1)?.url ?? images?.[0]?.url ?? null;
};

export const slimArtist = (artist: SpotifyArtist): ArtistInfo => ({
  id: artist.id,
  name: artist.name,
  genres: artist.genres ?? [],
  imageUrl: pickImage(artist.images),
});

export const slimTrack = (track: SpotifyTrack): TrackInfo => ({
  id: track.id,
  uri: track.uri,
  name: track.name,
  artists: track.artists.map(({ id, name }) => ({ id, name })),
  album: track.album.name,
  imageUrl: pickImage(track.album.images),
  isrc: track.external_ids?.isrc ?? null,
});

// Local files have no Spotify id and can't be suggested or matched.
const isSpotifyTrack = (track: SpotifyTrack | null): track is SpotifyTrack => Boolean(track?.id) && !track?.is_local;

const perRange = async <T>(load: (range: TimeRange) => Promise<T>): Promise<Record<TimeRange, T>> => {
  const [short, medium, long] = await Promise.all(timeRanges.map(load));

  return { short_term: short as T, medium_term: medium as T, long_term: long as T };
};

export const collectTaste = async (get: SpotifyGet): Promise<RawTaste> => {
  const [topArtists, topTracks, recent, saved, followed] = await Promise.all([
    perRange(async (range) => (await getTopArtists(get, range)).map(slimArtist)),
    perRange(async (range) => (await getTopTracks(get, range)).filter(isSpotifyTrack).map(slimTrack)),
    getRecentlyPlayed(get),
    getSavedTracks(get),
    getFollowedArtists(get),
  ]);

  return {
    topArtists,
    topTracks,
    recent: recent.filter((play) => isSpotifyTrack(play.track)).map((play) => ({ track: slimTrack(play.track), playedAt: play.played_at })),
    saved: saved.items.map((item) => item.track).filter(isSpotifyTrack).map(slimTrack),
    savedTotal: saved.total,
    followed: followed.map(slimArtist),
  };
};
