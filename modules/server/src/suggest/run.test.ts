import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeRefused } from '../errors.ts';
import { json, loggedInApp, mockFetch } from '../testing.ts';
import type { Suggestion, SuggestClient } from './claude.ts';
import type { Run } from './store.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const artist = (id: string): { id: string; name: string; uri: string } => ({ id, name: id.toUpperCase(), uri: `spotify:artist:${id}` });

const track = (id: string, artistId: string, name: string): Record<string, unknown> => ({
  id,
  uri: `spotify:track:${id}`,
  name,
  artists: [artist(artistId)],
  album: { id: 'al', name: 'Album', images: [] },
  external_ids: { isrc: `ISRC-${id}` },
});

const page = (items: unknown[]): Record<string, unknown> => ({ items, next: null, total: items.length, cursors: null });

// Spotify for one listener who plays KNOWN's song "Old Favourite", and whose search finds
// "New Song" by NEWBIE and "Old Favourite" by KNOWN.
const fakeSpotify = (): void => {
  const searchable = [track('new1', 'newbie', 'New Song'), track('old1', 'known', 'Old Favourite')];

  const routes: Record<string, () => unknown> = {
    '/v1/me/top/artists': () => page([{ ...artist('known'), genres: [], images: [] }]),
    '/v1/me/top/tracks': () => page([track('old1', 'known', 'Old Favourite')]),
    '/v1/me/player/recently-played': () => page([]),
    '/v1/me/tracks': () => page([]),
    '/v1/me/following': () => ({ artists: page([]) }),
    '/v1/me/library/contains': () => [false, false],
  };

  mockFetch((url) => {
    if (url.pathname === '/v1/search') {
      const query = (url.searchParams.get('q') ?? '').toLowerCase();

      return json({ tracks: page(searchable.filter((item) => query.includes(String(item.name).toLowerCase()))) });
    }

    const route = routes[url.pathname];

    return route ? json(route()) : undefined;
  });
};

const fakeClaude = (suggestions: Suggestion[]): SuggestClient & { prompts: string[] } => {
  const prompts: string[] = [];

  return { prompts, ask: async ({ user }) => (prompts.push(user), { suggestions, usage: { input: 1000, output: 500 } }) };
};

const suggestions: Suggestion[] = [
  { artist: 'NEWBIE', title: 'New Song', reason: 'Like KNOWN but faster.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'Invented Song', reason: 'Made up.', kind: 'wildcard', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'New Song - Remastered', reason: 'Same song again.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'KNOWN', title: 'Old Favourite', reason: 'You play this a lot.', kind: 'close', artist_alt: null, title_alt: null },
];

const postRun = (app: ReturnType<typeof loggedInApp>['app'], cookie: string, body: unknown): Promise<Response> =>
  Promise.resolve(
    app.request('/api/runs', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

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
    const refusing: SuggestClient = { ask: async () => Promise.reject(new ClaudeRefused('cyber', 'Not allowed.')) };
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
    const first = (await (await app.request('/api/runs', { method: 'POST', headers, body: '{"discovery":"close"}' })).json()) as Run;

    await app.request(`/api/runs/${first.id}/tracks/0`, { method: 'PUT', headers, body: '{"removed":true}' });
    const refined = (await (await app.request(`/api/runs/${first.id}/refine`, { method: 'POST', headers, body: '{"note":"less sad"}' })).json()) as Run;
    const latest = (await (await app.request('/api/runs/latest', { headers })).json()) as { run: Run };

    expect(claude.prompts[1]).toContain('<previous_list>\n- NEWBIE — New Song');
    expect(claude.prompts[1]).toContain('Their note on that list: "less sad"');
    expect(refined.refinedFrom).toBe(first.id);
    expect(latest.run.id).toBe(refined.id);
    const putBack = await app.request(`/api/runs/${first.id}/tracks/0`, { method: 'PUT', headers, body: '{"removed":false}' });

    expect(await putBack.json()).toEqual({ ok: true });
  });
});
