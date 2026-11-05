import { cached } from '../cache/index.ts';
import type { Db } from '../db/index.ts';
import { searchTracks, type SpotifyGet } from '../spotify/index.ts';
import { slimTrack, type TrackInfo } from '../taste/collect.ts';
import { normalize, pickMatch, searchQueries, type Wanted } from './match.ts';

// Looks each suggestion up on Spotify. Results (found or not) are cached for two weeks,
// so a song Claude suggests again costs no quota.

const searchMaxAgeMs = 14 * 24 * 60 * 60 * 1000;
const parallelSearches = 4;

export const findOnSpotify = async (db: Db, get: SpotifyGet, wanted: Wanted): Promise<TrackInfo | null> => {
  const { value } = await cached<TrackInfo | null>(db, {
    // v2: matching learned other spellings (romanized names); older misses are not trusted.
    key: `search2:${normalize(wanted.artist)}|${normalize(wanted.title)}`,
    maxAgeMs: searchMaxAgeMs,
    load: async () => {
      for (const query of searchQueries(wanted)) {
        const results = (await searchTracks(get, query.q)).filter((track) => track.id && !track.is_local);
        const match = pickMatch(wanted, results, query.artistFiltered);

        if (match) return slimTrack(match);
      }

      return null;
    },
  });

  return value;
};

// Like Promise.all over `items`, but at most `limit` at a time, keeping the order.
export const mapLimit = async <T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;

      results[index] = await run(items[index] as T);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};

export const verifyAll = (db: Db, get: SpotifyGet, wanted: Wanted[]): Promise<(TrackInfo | null)[]> =>
  mapLimit(wanted, parallelSearches, (item) => findOnSpotify(db, get, item));
