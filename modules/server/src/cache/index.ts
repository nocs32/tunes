import type { Db } from '../db/index.ts';

// Keeps JSON results in SQLite. `load` runs only when there is no entry younger than `maxAgeMs`,
// or when `force` is set (the page's "Refresh" button).

export type Cached<T> = { value: T; fetchedAt: number };

type CacheOptions<T> = { key: string; maxAgeMs: number; force?: boolean; load: () => Promise<T> };

export const cached = async <T>(db: Db, { key, maxAgeMs, force = false, load }: CacheOptions<T>): Promise<Cached<T>> => {
  const row = db.prepare('SELECT value, fetched_at FROM api_cache WHERE key = ?').get(key) as
    | { value: string; fetched_at: number }
    | undefined;

  if (row && !force && Date.now() - row.fetched_at < maxAgeMs) {
    return { value: JSON.parse(row.value) as T, fetchedAt: row.fetched_at };
  }

  const value = await load();
  const fetchedAt = Date.now();

  db.prepare(
    'INSERT INTO api_cache (key, value, fetched_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at',
  ).run(key, JSON.stringify(value), fetchedAt);

  return { value, fetchedAt };
};
