import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveHistory } from '../history/index.ts';
import { historyTrack } from '../history/testing.ts';
import { fakeClaude, fakeSpotify, postRun } from '../suggest/fakes.ts';
import type { Run } from '../suggest/store.ts';
import { loggedInApp } from '../testing.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Old favourites (many plays, last in 2024), a recent favourite and a Russian title.
const history = [
  historyTrack(1, 'Old One', { '2024-03': 40 }),
  historyTrack(2, 'Old Two', { '2024-05': 20 }),
  historyTrack(3, 'Now', { '2026-10': 50 }),
  historyTrack(4, 'Band', { '2024-01': 30 }, { title: 'Белый дым' }),
];

describe('Rediscover', () => {
  it('lets Claude pick from old favourites only, in Claude’s order, each once', async () => {
    fakeSpotify();

    const claude = fakeClaude([], [
      { number: 2, reason: 'Fits now.' },
      { number: 1, reason: 'Brings back 2024.' },
      { number: 2, reason: 'Again.' },
      { number: 9, reason: 'Not on the list.' },
    ]);

    const { app, db, cookie } = loggedInApp(claude);

    saveHistory(db, 'anna', history);

    const run = (await (await postRun(app, cookie, { mood: '' }, '/api/runs/rediscover')).json()) as Run;

    expect(run.discovery).toBe('rediscover');

    expect(run.tracks.map((item) => [item.track.id, item.kind, item.reason])).toEqual([
      ['Hist000000000000000002', 'old', 'Fits now.'],
      ['Hist000000000000000001', 'old', 'Brings back 2024.'],
    ]);

    expect(claude.prompts[0]).toContain('1. Old One — Song 1 (40 plays, last 03/2024)');
    expect(claude.prompts[0]).not.toContain('Song 3 (');
    expect(claude.prompts[0]).not.toContain('Белый дым (');
  });

  it('keeps at most two songs per artist', async () => {
    fakeSpotify();
    const picks = [1, 2, 3].map((number) => ({ number, reason: 'r' }));
    const { app, db, cookie } = loggedInApp(fakeClaude([], picks));

    saveHistory(db, 'anna', [1, 2, 3].map((n) => historyTrack(n, 'Same', { '2024-03': 10 + n })));

    const run = (await (await postRun(app, cookie, { mood: '' }, '/api/runs/rediscover')).json()) as Run;

    expect(run.tracks).toHaveLength(2);
  });

  it('asks for the history first', async () => {
    fakeSpotify();
    const { app, cookie } = loggedInApp(fakeClaude([]));
    const response = await postRun(app, cookie, { mood: '' }, '/api/runs/rediscover');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining('import your full history') });
  });
});
