import { describe, expect, it } from 'vitest';
import { loggedInApp } from '../testing.ts';
import { historyTrack } from './testing.ts';

const call = async ({ app, cookie }: ReturnType<typeof loggedInApp>, method: string, body?: unknown): Promise<{ status: number; json: unknown }> => {
  const response = await app.request('/api/history', {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, json: await response.json() };
};

describe('/api/history', () => {
  it('imports, replaces and removes the history', async () => {
    const setup = loggedInApp();

    expect((await call(setup, 'GET')).json).toEqual({ history: null });

    const first = await call(setup, 'PUT', { tracks: [historyTrack(1, 'A', { '2024-01': 3 }), historyTrack(2, 'B', { '2026-01': 2 })] });

    expect(first.json).toMatchObject({ history: { plays: 5, tracks: 2, firstAt: Date.parse('2024-01-15T12:00:00Z') } });

    await call(setup, 'PUT', { tracks: [historyTrack(3, 'C', { '2026-05': 1 })] });

    expect((await call(setup, 'GET')).json).toMatchObject({ history: { plays: 1, tracks: 1 } });
    expect((await call(setup, 'DELETE')).json).toEqual({ history: null });
    expect((await call(setup, 'GET')).json).toEqual({ history: null });
  });

  it('refuses anything that isn’t per-song totals', async () => {
    const setup = loggedInApp();
    const bad = await call(setup, 'PUT', { tracks: [{ ...historyTrack(1, 'A', {}), uri: 'spotify:episode:x', ip_addr: '1.2.3.4' }] });

    expect(bad.status).toBe(400);
  });
});
