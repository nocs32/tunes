import { decrypt } from '../auth/crypto.ts';
import { deleteUserSessions } from '../auth/sessions.ts';
import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { ReloginNeeded } from '../errors.ts';
import { getUser, saveTokens, type User } from '../users/index.ts';
import { refreshTokens } from './accounts.ts';
import type { SpotifyGet } from './api.ts';
import { spotifyFetch } from './client.ts';

export * from './accounts.ts';
export * from './api.ts';
export * from './client.ts';
export * from './types.ts';

// Refresh a minute early so a token never expires mid-run.
const refreshMarginMs = 60_000;

// One refresh per user at a time: parallel calls wait for the same refresh.
const refreshing = new Map<string, Promise<string>>();

const refreshAndSave = async (db: Db, env: Env, user: User): Promise<string> => {
  try {
    const tokens = await refreshTokens(decrypt(user.sealedRefreshToken, env.TOKEN_KEY), env.SPOTIFY_CLIENT_ID);

    saveTokens(db, user.id, tokens, env.TOKEN_KEY);

    return tokens.accessToken;
  } catch (error) {
    if (error instanceof ReloginNeeded) deleteUserSessions(db, user.id);

    throw error;
  }
};

export const accessTokenFor = async (db: Db, env: Env, userId: string): Promise<string> => {
  const user = getUser(db, userId);

  if (!user) throw new ReloginNeeded();

  if (user.tokenExpiresAt - Date.now() > refreshMarginMs) return decrypt(user.sealedAccessToken, env.TOKEN_KEY);

  const pending = refreshing.get(user.id) ?? refreshAndSave(db, env, user).finally(() => refreshing.delete(user.id));

  refreshing.set(user.id, pending);

  return pending;
};

// A GET helper for one user: fresh token, rate limits handled.
export const spotifyGetFor = (db: Db, env: Env, userId: string): SpotifyGet => {
  return async <T>(path: string): Promise<T> => spotifyFetch<T>(await accessTokenFor(db, env, userId), path);
};
