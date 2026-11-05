import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeClaude, fakeSpotify, postRun, suggestions } from '../suggest/fakes.ts';
import type { Run, RunSummary } from '../suggest/store.ts';
import { loggedInApp } from '../testing.ts';
import { feedbackText } from './index.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

type App = ReturnType<typeof loggedInApp>;

const vote = async ({ app, cookie }: App, runId: number, position: number, value: 'up' | 'down' | null): Promise<Response> =>
  app.request(`/api/runs/${runId}/tracks/${position}/vote`, {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote: value }),
  });

const firstRun = async (setup: App): Promise<Run> => (await (await postRun(setup.app, setup.cookie, { discovery: 'mixed' })).json()) as Run;

describe('thumbs up and down', () => {
  it('saves a vote, shows it on the run, and can take it back', async () => {
    fakeSpotify();
    const setup = loggedInApp(fakeClaude(suggestions));
    const run = await firstRun(setup);

    await vote(setup, run.id, 0, 'up');
    let again = (await (await setup.app.request(`/api/runs/${run.id}`, { headers: { Cookie: setup.cookie } })).json()) as Run;

    expect(again.tracks[0]?.vote).toBe('up');
    expect(feedbackText(setup.db, 'anna')).toBe('FEEDBACK ON EARLIER SUGGESTIONS (their own thumbs, most recent first)\nLiked:\n- NEWBIE — New Song');

    await vote(setup, run.id, 0, null);
    again = (await (await setup.app.request(`/api/runs/${run.id}`, { headers: { Cookie: setup.cookie } })).json()) as Run;

    expect(again.tracks[0]?.vote).toBeNull();
    expect(feedbackText(setup.db, 'anna')).toBe('');
  });

  it('tells Claude, and leaves a disliked song out of the next run', async () => {
    fakeSpotify();
    const claude = fakeClaude(suggestions);
    const setup = loggedInApp(claude);
    const run = await firstRun(setup);

    await vote(setup, run.id, 0, 'down');
    const next = (await (await postRun(setup.app, setup.cookie, { discovery: 'mixed' })).json()) as Run;

    expect(claude.prompts[1]).toContain('Disliked:\n- NEWBIE — New Song');
    expect(next.tracks.map((item) => item.track.name)).not.toContain('New Song');
    expect(next.dropped).toContainEqual({ artist: 'NEWBIE', title: 'New Song', reason: 'disliked' });
  });

  it('labels a liked song as known when it comes up again', async () => {
    fakeSpotify();
    const setup = loggedInApp(fakeClaude(suggestions));
    const run = await firstRun(setup);

    await vote(setup, run.id, 0, 'up');
    const next = (await (await postRun(setup.app, setup.cookie, { discovery: 'mixed' })).json()) as Run;

    expect(next.tracks.find((item) => item.track.name === 'New Song')).toMatchObject({ known: true, vote: 'up' });
  });
});

describe('earlier runs', () => {
  it('lists runs newest first with how many songs are kept', async () => {
    fakeSpotify();
    const setup = loggedInApp(fakeClaude(suggestions));
    const first = await firstRun(setup);
    const second = await firstRun(setup);

    await setup.app.request(`/api/runs/${second.id}/tracks/0`, {
      method: 'PUT',
      headers: { Cookie: setup.cookie, 'Content-Type': 'application/json' },
      body: '{"removed":true}',
    });

    const { runs } = (await (await setup.app.request('/api/runs', { headers: { Cookie: setup.cookie } })).json()) as { runs: RunSummary[] };

    expect(runs.map((item) => [item.id, item.songs])).toEqual([
      [second.id, second.tracks.length - 1],
      [first.id, first.tracks.length],
    ]);
  });
});
