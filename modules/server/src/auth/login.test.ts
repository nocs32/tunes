import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookiesFrom, json, mockFetch, testApp } from '../testing.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const spotifyLogin = (): ReturnType<typeof mockFetch> =>
  mockFetch(
    (url) => (url.pathname === '/api/token' ? json({ access_token: 'at', expires_in: 3600, refresh_token: 'rt' }) : undefined),
    (url) => (url.pathname === '/v1/me' ? json({ id: 'anna', display_name: 'Anna', images: [] }) : undefined),
  );

describe('login', () => {
  it('sends the browser to Spotify with a PKCE challenge and remembers the state', async () => {
    const response = await testApp().request('/api/auth/login');
    const location = new URL(response.headers.get('Location') ?? '');

    expect(response.status).toBe(302);
    expect(location.origin).toBe('https://accounts.spotify.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5180/api/auth/callback');
    expect(cookiesFrom(response)).toMatch(/^tunes_oauth=/);
  });

  it('rejects a callback whose state does not match', async () => {
    const app = testApp();
    const login = await app.request('/api/auth/login');
    const callback = await app.request('/api/auth/callback?code=c&state=wrong', { headers: { Cookie: cookiesFrom(login) } });

    expect(callback.headers.get('Location')).toBe('/?login=failed');
  });

  it('logs in, knows the user, and logs out', async () => {
    const fetchMock = spotifyLogin();
    const app = testApp();
    const login = await app.request('/api/auth/login');
    const state = new URL(login.headers.get('Location') ?? '').searchParams.get('state');
    const callback = await app.request(`/api/auth/callback?code=c&state=${state}`, { headers: { Cookie: cookiesFrom(login) } });
    const session = cookiesFrom(callback).split('; ').find((cookie) => cookie.startsWith('tunes_session=')) ?? '';

    expect(callback.headers.get('Location')).toBe('/');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(await (await app.request('/api/me', { headers: { Cookie: session } })).json()).toEqual({
      id: 'anna',
      displayName: 'Anna',
      imageUrl: null,
      playlistMode: 'rolling',
    });

    await app.request('/api/auth/logout', { method: 'POST', headers: { Cookie: session } });
    expect((await app.request('/api/me', { headers: { Cookie: session } })).status).toBe(401);
  });

});

describe('login callback', () => {
  it('says "denied" when the person cancels on Spotify', async () => {
    const app = testApp();
    const login = await app.request('/api/auth/login');
    const state = new URL(login.headers.get('Location') ?? '').searchParams.get('state');

    const callback = await app.request(`/api/auth/callback?error=access_denied&state=${state}`, {
      headers: { Cookie: cookiesFrom(login) },
    });

    expect(callback.headers.get('Location')).toBe('/?login=denied');
  });
});
