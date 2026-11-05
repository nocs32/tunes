import { setTimeout as sleep } from 'node:timers/promises';
import { ReloginNeeded, SpotifyBusy, SpotifyError } from '../errors.ts';

// One request to the Web API, with Spotify's rate limits handled:
// - 429 with Retry-After: wait that long (up to maxWaitSeconds) and try again, a few times.
// - 429 QUOTA_EXCEEDED (Development Mode quota) with no Retry-After: stop at once. Retrying
//   only burns more quota, so the page says "try later" instead.
// - 401 with a fresh token: the login is gone, so log in again.

const apiBase = 'https://api.spotify.com/v1';
const maxAttempts = 4;
const maxWaitSeconds = 20;

type SpotifyErrorBody = { error?: { status?: number; message?: string; reason?: string } };

const readError = async (response: Response): Promise<SpotifyErrorBody['error']> => {
  const body = (await response.json().catch(() => ({}))) as SpotifyErrorBody;

  return body.error;
};

// Seconds to wait before retrying a 429, or undefined when we shouldn't retry.
const retryDelay = (response: Response, reason: string | undefined, attempt: number): number | undefined => {
  const header = Number(response.headers.get('Retry-After'));

  if (Number.isFinite(header) && header > 0) {
    return header <= maxWaitSeconds && attempt < maxAttempts ? header : undefined;
  }

  if (reason === 'QUOTA_EXCEEDED') return undefined;

  // No header and no reason: back off 1, 2, 4 s.
  return attempt < maxAttempts ? 2 ** (attempt - 1) : undefined;
};

const handle429 = async (response: Response, attempt: number): Promise<void> => {
  const error = await readError(response);
  const delay = retryDelay(response, error?.reason, attempt);

  if (delay === undefined) throw new SpotifyBusy(error?.reason === 'QUOTA_EXCEEDED');

  await sleep(delay * 1000 + Math.random() * 250);
};

export const spotifyFetch = async <T>(token: string, path: string, init: RequestInit = {}): Promise<T> => {
  const url = path.startsWith('https://') ? path : `${apiBase}${path}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers };

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { ...init, headers });

    if (response.status === 429) {
      await handle429(response, attempt);
      continue;
    }

    if (response.status === 401) throw new ReloginNeeded();

    if (!response.ok) {
      const error = await readError(response);

      throw new SpotifyError(response.status, `Spotify: ${error?.message ?? response.statusText} (${response.status})`);
    }

    const text = await response.text();

    return (text ? JSON.parse(text) : undefined) as T;
  }
};
