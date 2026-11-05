import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeClaude, fakeSpotify, postRun, seedId, suggestions } from '../suggest/fakes.ts';
import type { Run } from '../suggest/store.ts';
import type { TrackInfo } from '../taste/collect.ts';
import { loggedInApp } from '../testing.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

type App = ReturnType<typeof loggedInApp>;

// A 22-character Spotify-like id ending in a number.
const pickId = (n: number): string => `Pick${String(n).padStart(18, '0')}`;

const crate = async ({ app, cookie }: App, method: string, path = '', body?: unknown): Promise<{ status: number; tracks: TrackInfo[] }> => {
  const response = await app.request(`/api/crate${path}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = (await response.json()) as { tracks?: TrackInfo[] };

  return { status: response.status, tracks: json.tracks ?? [] };
};

describe('the crate', () => {
  it('adds songs once, in order, takes one out and empties', async () => {
    fakeSpotify();
    const setup = loggedInApp();

    await crate(setup, 'POST', '', { trackId: seedId });
    await crate(setup, 'POST', '', { trackId: pickId(1) });
    const again = await crate(setup, 'POST', '', { trackId: seedId });

    expect(again.tracks.map((track) => track.name)).toEqual(['Seed Song', 'Pick 01']);
    expect((await crate(setup, 'DELETE', `/${seedId}`)).tracks.map((track) => track.id)).toEqual([pickId(1)]);
    expect((await crate(setup, 'DELETE')).tracks).toEqual([]);
  });

  it('holds at most 10 songs', async () => {
    fakeSpotify();
    const setup = loggedInApp();

    for (let n = 1; n <= 10; n++) await crate(setup, 'POST', '', { trackId: pickId(n) });

    const full = await crate(setup, 'POST', '', { trackId: pickId(11) });

    expect(full.status).toBe(400);
    expect((await crate(setup, 'GET')).tracks).toHaveLength(10);
  });

  it('builds a mix around every song in it, all of them first', async () => {
    fakeSpotify();
    const claude = fakeClaude(suggestions);
    const setup = loggedInApp(claude);

    await crate(setup, 'POST', '', { trackId: seedId });
    await crate(setup, 'POST', '', { trackId: pickId(7) });
    const run = (await (await postRun(setup.app, setup.cookie, { discovery: 'mixed', seedTrackIds: [seedId, pickId(7)] })).json()) as Run;

    expect(run.seeds.map((track) => track.name)).toEqual(['Seed Song', 'Pick 07']);

    expect(run.tracks.slice(0, 2).map((item) => [item.track.name, item.kind])).toEqual([
      ['Seed Song', 'seed'],
      ['Pick 07', 'seed'],
    ]);

    expect(claude.prompts[0]).toContain('They picked these songs and asked for more like them:\n- SEEDER — Seed Song\n- PICKER — Pick 07');
    expect((await crate(setup, 'GET')).tracks).toHaveLength(2);
  });
});
