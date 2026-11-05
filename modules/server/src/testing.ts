import { vi } from 'vitest';
import { createApp } from './app.ts';
import { openDb } from './db/index.ts';
import type { Env } from './env.ts';

// Shared helpers for tests. Never imported by the server itself.

export const testEnv: Env = {
  API_PORT: 0,
  API_HOST: '127.0.0.1',
  PUBLIC_URL: 'http://127.0.0.1:5180',
  SPOTIFY_CLIENT_ID: 'test-client',
  TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
  DATABASE_PATH: ':memory:',
  WEB_DIST: '',
  NODE_ENV: 'test',
};

export const testApp = (): ReturnType<typeof createApp> => createApp(openDb(':memory:'), testEnv);

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

type Route = (url: URL, init: RequestInit | undefined) => Response | undefined;

// Replaces global fetch: each request goes to the first route that answers it.
export const mockFetch = (...routes: Route[]): ReturnType<typeof vi.fn> => {
  const fake = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const response = routes.reduce<Response | undefined>((found, route) => found ?? route(url, init), undefined);

    if (!response) throw new Error(`Unexpected fetch: ${url}`);

    return response;
  });

  vi.stubGlobal('fetch', fake);

  return fake;
};

// The cookies a response sets, as "name=value" pairs for the next request's Cookie header.
export const cookiesFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
