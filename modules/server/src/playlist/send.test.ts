import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { saveRun, setRemoved } from '../suggest/store.ts';
import type { TrackInfo } from '../taste/collect.ts';
import { json, loggedInApp, mockFetch } from '../testing.ts';
import { getUser } from '../users/index.ts';
import type { Sent } from './index.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const track = (id: string): TrackInfo => ({
  id,
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  artists: [{ id: 'a', name: 'A' }],
  album: 'Album',
  imageUrl: null,
  isrc: null,
});

// A saved run with three songs, the second one left out with ✕.
const seedRun = (db: Db): number => {
  const { id } = saveRun(db, 'anna', {
    createdAt: Date.UTC(2026, 10, 5),
    mood: 'night drive',
    discovery: 'mixed',
    refinedFrom: null,
    note: null,
    asked: 3,
    dropped: [],
    tracks: ['t1', 't2', 't3'].map((id, position) => ({ position, track: track(id), reason: 'r', kind: 'close', known: false, removed: false })),
    usage: null,
    durationMs: null,
    seeds: [],
  });

  setRemoved(db, id, 1, true);

  return id;
};

type Call = { method: string; path: string; body: unknown };

// A fake Spotify that records playlist calls. `inLibrary` answers the "is the playlist still saved" check.
const fakeSpotify = (inLibrary: boolean): Call[] => {
  const calls: Call[] = [];
  let created = 0;

  mockFetch((url, init) => {
    const method = init?.method ?? 'GET';

    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });

    if (url.pathname === '/v1/me/library/contains') return json([inLibrary]);

    if (url.pathname === '/v1/me/playlists' && method === 'POST') return json({ id: `pl${++created}`, name: JSON.parse(String(init?.body)).name }, 201);

    return url.pathname.startsWith('/v1/playlists/') ? json({ snapshot_id: 's' }) : undefined;
  });

  return calls;
};

const send = async (app: ReturnType<typeof loggedInApp>['app'], cookie: string, runId: number, mode: string): Promise<Response> =>
  app.request(`/api/runs/${runId}/playlist`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });

describe('sending a run to Spotify', () => {
  it('makes the rolling "Tunes" playlist once, then replaces its songs', async () => {
    const calls = fakeSpotify(true);
    const { app, db, cookie } = loggedInApp();
    const runId = seedRun(db);
    const first = (await (await send(app, cookie, runId, 'rolling')).json()) as Sent;

    expect(first).toMatchObject({ id: 'pl1', name: 'Tunes', count: 2, url: 'https://open.spotify.com/playlist/pl1' });
    expect(calls.find((call) => call.method === 'POST' && call.path === '/v1/me/playlists')?.body).toMatchObject({ name: 'Tunes', public: false });
    expect(calls.find((call) => call.path === '/v1/playlists/pl1/items')?.body).toEqual({ uris: ['spotify:track:t1', 'spotify:track:t3'] });

    calls.length = 0;
    await send(app, cookie, runId, 'rolling');

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /v1/me/library/contains',
      'PUT /v1/playlists/pl1',
      'PUT /v1/playlists/pl1/items',
    ]);

    expect(getUser(db, 'anna')?.playlistId).toBe('pl1');
  });

  it('makes a new rolling playlist if the old one was deleted in Spotify', async () => {
    fakeSpotify(false);
    const { app, db, cookie } = loggedInApp();
    const runId = seedRun(db);

    await send(app, cookie, runId, 'rolling');
    const second = (await (await send(app, cookie, runId, 'rolling')).json()) as Sent;

    expect(second.id).toBe('pl2');
  });

  it('makes a dated playlist in "new" mode and remembers the choice', async () => {
    fakeSpotify(true);
    const { app, db, cookie } = loggedInApp();
    const sent = (await (await send(app, cookie, seedRun(db), 'new')).json()) as Sent;

    expect(sent.name).toBe('Tunes: night drive, 5 Nov');
    expect(getUser(db, 'anna')?.settings.playlistMode).toBe('new');
    expect(getUser(db, 'anna')?.playlistId).toBeNull();
  });
});
