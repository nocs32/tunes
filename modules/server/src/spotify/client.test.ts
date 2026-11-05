import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReloginNeeded, SpotifyBusy, SpotifyError } from '../errors.ts';
import { json, mockFetch } from '../testing.ts';
import { spotifyFetch } from './client.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const sequence = (...responses: Response[]): ReturnType<typeof mockFetch> => {
  let index = 0;

  return mockFetch(() => responses[index++]);
};

describe('spotifyFetch', () => {
  it('waits for Retry-After and tries again', async () => {
    const fetchMock = sequence(json({ error: { status: 429 } }, 429, { 'Retry-After': '1' }), json({ ok: 1 }));

    await expect(spotifyFetch('t', '/me')).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops at once on QUOTA_EXCEEDED without Retry-After', async () => {
    const fetchMock = sequence(json({ error: { status: 429, message: 'Too many requests', reason: 'QUOTA_EXCEEDED' } }, 429));
    const result = spotifyFetch('t', '/me');

    await expect(result).rejects.toBeInstanceOf(SpotifyBusy);
    await expect(result).rejects.toMatchObject({ quota: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up when Spotify asks for a long wait', async () => {
    sequence(json({ error: { status: 429 } }, 429, { 'Retry-After': '3600' }));

    await expect(spotifyFetch('t', '/me')).rejects.toMatchObject({ quota: false });
  });

  it('asks for a new login on 401', async () => {
    sequence(json({ error: { status: 401, message: 'The access token expired' } }, 401));

    await expect(spotifyFetch('t', '/me')).rejects.toBeInstanceOf(ReloginNeeded);
  });

  it('reports other errors with Spotify’s message', async () => {
    sequence(json({ error: { status: 403, message: 'User not registered in the Developer Dashboard' } }, 403));

    await expect(spotifyFetch('t', '/me')).rejects.toEqual(new SpotifyError(403, 'Spotify: User not registered in the Developer Dashboard (403)'));
  });

  it('follows full next-page URLs as given', async () => {
    const fetchMock = sequence(json({ items: [] }));

    await spotifyFetch('t', 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.spotify.com/v1/me/tracks?offset=50&limit=50');
  });
});
