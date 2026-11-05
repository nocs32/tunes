import { json, loggedInApp, mockFetch } from '../testing.ts';
import type { Suggestion, SuggestClient } from './claude.ts';

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

// Spotify for one listener who plays KNOWN's song "Old Favourite", and whose search finds
// "New Song" by NEWBIE and "Old Favourite" by KNOWN.
export const fakeSpotify = (): void => {
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

export const fakeClaude = (suggestions: Suggestion[]): SuggestClient & { prompts: string[] } => {
  const prompts: string[] = [];

  return { prompts, ask: async ({ user }) => (prompts.push(user), { suggestions, usage: { input: 1000, output: 500 } }) };
};

export const suggestions: Suggestion[] = [
  { artist: 'NEWBIE', title: 'New Song', reason: 'Like KNOWN but faster.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'Invented Song', reason: 'Made up.', kind: 'wildcard', artist_alt: null, title_alt: null },
  { artist: 'NEWBIE', title: 'New Song - Remastered', reason: 'Same song again.', kind: 'close', artist_alt: null, title_alt: null },
  { artist: 'KNOWN', title: 'Old Favourite', reason: 'You play this a lot.', kind: 'close', artist_alt: null, title_alt: null },
];

export const postRun = (app: ReturnType<typeof loggedInApp>['app'], cookie: string, body: unknown): Promise<Response> =>
  Promise.resolve(
    app.request('/api/runs', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
