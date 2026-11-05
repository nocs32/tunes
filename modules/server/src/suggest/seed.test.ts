import { afterEach, describe, expect, it, vi } from 'vitest';
import { loggedInApp } from '../testing.ts';
import type { Suggestion } from './claude.ts';
import { fakeClaude, fakeSpotify, postRun, seedId, suggestions } from './fakes.ts';
import type { Run } from './store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Claude also suggests the seed itself, which must not appear twice.
const withSeedAgain: Suggestion[] = [
  ...suggestions,
  { artist: 'SEEDER', title: 'Seed Song', reason: 'Again.', kind: 'close', artist_alt: null, title_alt: null },
];

describe('More like this', () => {
  it('builds the run around the song, puts it first and never twice', async () => {
    fakeSpotify();
    const claude = fakeClaude(withSeedAgain);
    const { app, cookie } = loggedInApp(claude);
    const run = (await (await postRun(app, cookie, { discovery: 'mixed', seedTrackId: seedId })).json()) as Run;

    expect(claude.prompts[0]).toContain('<seed>\nThey asked for more like this song: SEEDER — Seed Song');
    expect(run.seed?.name).toBe('Seed Song');
    expect(run.tracks[0]).toMatchObject({ position: 0, kind: 'seed', known: true, track: { id: seedId } });
    expect(run.tracks.filter((item) => item.track.id === seedId)).toHaveLength(1);
    expect(run.dropped).toContainEqual({ artist: 'SEEDER', title: 'Seed Song', reason: 'duplicate' });
    expect(run.tracks.map((item) => item.position)).toEqual(run.tracks.map((_, index) => index));
  });

  it('keeps the seed when the list is reworked, without listing it as a previous suggestion', async () => {
    fakeSpotify();
    const claude = fakeClaude(suggestions);
    const { app, cookie } = loggedInApp(claude);
    const first = (await (await postRun(app, cookie, { discovery: 'close', seedTrackId: seedId })).json()) as Run;
    const reworked = (await (await postRun(app, cookie, { note: 'faster' }, `/api/runs/${first.id}/refine`)).json()) as Run;

    expect(reworked.seed?.id).toBe(seedId);
    expect(reworked.tracks[0]?.kind).toBe('seed');
    expect(claude.prompts[1]).toContain('<seed>');
    expect(claude.prompts[1]).not.toContain('- SEEDER — Seed Song');
  });

  it('refuses something that is not a Spotify track id', async () => {
    fakeSpotify();
    const { app, cookie } = loggedInApp(fakeClaude(suggestions));

    const response = await app.request('/api/runs', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ discovery: 'mixed', seedTrackId: '../../me' }),
    });

    expect(response.status).toBe(400);
  });
});
