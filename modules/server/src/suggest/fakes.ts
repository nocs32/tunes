import { json, loggedInApp, mockFetch } from '../testing.ts';
import type { Pick, Suggestion, SuggestClient } from './claude.ts';

// Test-only fakes shared by the run and feedback tests.

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

// A song to ask "More like this" about (Spotify ids are 22 characters).
export const seedId = 'Seed000000000000000001';

const seedTrack = track(seedId, 'seeder', 'Seed Song');

// Spotify for one listener who plays KNOWN's song "Old Favourite", and whose search finds
// "New Song" by NEWBIE, "Old Favourite" by KNOWN and "Seed Song" by SEEDER.
export const fakeSpotify = (): void => {
  const searchable = [track('new1', 'newbie', 'New Song'), track('old1', 'known', 'Old Favourite'), seedTrack];

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

    if (url.pathname.startsWith('/v1/tracks/')) {
      const id = url.pathname.slice('/v1/tracks/'.length);

      return json(id === seedId ? seedTrack : track(id, 'picker', `Pick ${id.slice(-2)}`));
    }

    const route = routes[url.pathname];

    return route ? json(route()) : undefined;
  });
};

// `picks` answers Rediscover: numbers from the list Claude was given.
export const fakeClaude = (suggestions: Suggestion[], picks: Pick[] = []): SuggestClient & { prompts: string[] } => {
  const prompts: string[] = [];
  const usage = { input: 1000, output: 500 };

  return {
    prompts,
    ask: async ({ user }) => (prompts.push(user), { suggestions, usage }),
    pick: async ({ user }) => (prompts.push(user), { picks, usage }),
  };
};

export const suggestions: Suggestion[] = [
  { artist: 'NEWBIE', title: 'New Song', reason: 'Like KNOWN but faster.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'Invented Song', reason: 'Made up.', kind: 'wildcard', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'New Song - Remastered', reason: 'Same song again.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'KNOWN', title: 'Old Favourite', reason: 'You play this a lot.', kind: 'close', artist_alt: null, title_alt: null },
];

type TestApp = ReturnType<typeof loggedInApp>['app'];

// Waits for a started run (POST returned { jobId }) and answers like the old synchronous route:
// the run as JSON, or the error with its HTTP status.
export const finishJob = async (app: TestApp, cookie: string, started: Response): Promise<Response> => {
  const { jobId } = (await started.json()) as { jobId: string };

  for (;;) {
    const job = (await (await app.request(`/api/runs/jobs/${jobId}`, { headers: { Cookie: cookie } })).json()) as
      | { status: 'running' }
      | { status: 'done'; result: unknown }
      | { status: 'failed'; httpStatus: number; error: unknown };

    if (job.status === 'done') return json(job.result);

    if (job.status === 'failed') return json(job.error, job.httpStatus);

    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

export const postRun = async (app: TestApp, cookie: string, body: unknown, path = '/api/runs'): Promise<Response> => {
  const started = await app.request(path, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return finishJob(app, cookie, started);
};
