import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeRefused } from '../errors.ts';
import { loggedInApp } from '../testing.ts';
import type { SuggestClient } from './claude.ts';
import { fakeClaude, fakeSpotify, postRun, suggestions } from './fakes.ts';
import type { Run } from './store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/runs', () => {
  it('keeps found songs, labels known ones, and explains the rest', async () => {
    fakeSpotify();
    const claude = fakeClaude(suggestions);
    const { app, cookie } = loggedInApp(claude);

    const response = await postRun(app, cookie, { mood: 'night drive', discovery: 'mixed' });

    const run = (await response.json()) as Run;

    expect(response.status).toBe(200);

    expect(run.tracks.map((item) => [item.track.name, item.known])).toEqual([
      ['New Song', false],
      ['Old Favourite', true],
    ]);

    expect(run.dropped.map((item) => [item.title, item.reason])).toEqual([
      ['Invented Song', 'not_found'],
      ['New Song - Remastered', 'duplicate'],
    ]);

    expect(claude.prompts[0]).toContain('Request for this session: "night drive"');
  });

  it('drops songs by known artists on Adventurous', async () => {
    fakeSpotify();
    const { app, cookie } = loggedInApp(fakeClaude(suggestions));

    const response = await postRun(app, cookie, { discovery: 'adventurous' });

    const run = (await response.json()) as Run;

    expect(run.tracks.map((item) => item.track.name)).toEqual(['New Song']);
    expect(run.dropped).toContainEqual({ artist: 'KNOWN', title: 'Old Favourite', reason: 'known_artist' });
  });

  it('shows Claude’s refusal as a readable error', async () => {
    fakeSpotify();
    const refuse = async (): Promise<never> => Promise.reject(new ClaudeRefused('cyber', 'Not allowed.'));
    const refusing: SuggestClient = { ask: refuse, pick: refuse };
    const { app, cookie } = loggedInApp(refusing);

    const response = await postRun(app, cookie, { discovery: 'close' });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'claude_refused', message: expect.stringContaining('Not allowed.') });
  });
});

describe('refine and remove', () => {
  it('sends the previous list and the note, and remembers removed songs', async () => {
    fakeSpotify();
    const claude = fakeClaude(suggestions);
    const { app, cookie } = loggedInApp(claude);
    const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
    const first = (await (await postRun(app, cookie, { discovery: 'close' })).json()) as Run;

    await app.request(`/api/runs/${first.id}/tracks/0`, { method: 'PUT', headers, body: '{"removed":true}' });
    const refined = (await (await postRun(app, cookie, { note: 'less sad' }, `/api/runs/${first.id}/refine`)).json()) as Run;
    const latest = (await (await app.request('/api/runs/latest', { headers })).json()) as { run: Run };

    expect(claude.prompts[1]).toContain('<previous_list>\n- NEWBIE — New Song');
    expect(claude.prompts[1]).toContain('Their note on that list: "less sad"');
    expect(refined.refinedFrom).toBe(first.id);
    expect(latest.run.id).toBe(refined.id);
    const putBack = await app.request(`/api/runs/${first.id}/tracks/0`, { method: 'PUT', headers, body: '{"removed":false}' });

    expect(await putBack.json()).toEqual({ ok: true });
  });
});
