import { type Context, Hono } from 'hono';
import { requireUser } from '../auth/index.ts';
import { cached } from '../cache/index.ts';
import type { UserEnv } from '../context.ts';
import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { spotifyGetFor } from '../spotify/index.ts';
import { collectTaste, type RawTaste } from './collect.ts';
import { buildProfile, type TasteProfile } from './profile.ts';

export * from './collect.ts';
export * from './profile.ts';

// Spotify's top lists change slowly, so the raw data is reused for a few hours.
const tasteMaxAgeMs = 6 * 60 * 60 * 1000;

export const loadProfile = async (
  db: Db,
  env: Env,
  userId: string,
  force = false,
): Promise<{ profile: TasteProfile; fetchedAt: number }> => {
  const raw = await cached<RawTaste>(db, {
    key: `taste:${userId}`,
    maxAgeMs: tasteMaxAgeMs,
    force,
    load: () => collectTaste(spotifyGetFor(db, env, userId)),
  });

  return { profile: buildProfile(raw.value), fetchedAt: raw.fetchedAt };
};

// The profile as the page gets it. The known sets stay on the server (thousands of URIs the
// page doesn't need); the page gets their sizes.
export type TastePayload = {
  fetchedAt: number;
  profile: Omit<TasteProfile, 'known'>;
  knownCounts: { tracks: number; artists: number };
};

const forPage = async (c: Context<UserEnv>, force: boolean): Promise<TastePayload> => {
  const { profile, fetchedAt } = await loadProfile(c.var.db, c.var.env, c.var.user.id, force);
  const { known, ...shown } = profile;

  return { fetchedAt, profile: shown, knownCounts: { tracks: known.trackUris.length, artists: known.artistIds.length } };
};

// GET /api/taste uses the cache; POST /api/taste/refresh asks Spotify again (spends quota).
export const tasteRoutes = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await forPage(c, false)))
  .post('/refresh', async (c) => c.json(await forPage(c, true)));
