import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../auth/index.ts';
import type { UserEnv } from '../context.ts';
import { deleteHistory, historySummary, saveHistory } from './store.ts';

export * from './insights.ts';
export * from './store.ts';

// /api/history — the full streaming history (D24, D26).
//   GET    /  → { history }: what's imported (counts and dates), or null
//   PUT    /  { tracks } → { history }: replace it. The page reads Spotify's zip and sends only
//              per-song totals; the export's IP addresses and devices never leave the browser.
//   DELETE /  → { history: null }

const historyTrack = z.object({
  uri: z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/),
  artist: z.string().max(500),
  title: z.string().max(500),
  plays: z.number().int().min(0),
  skips: z.number().int().min(0),
  finishes: z.number().int().min(0),
  firstAt: z.number().int().nullable(),
  lastAt: z.number().int().nullable(),
  months: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().int().min(1)),
});

const historyBody = z.object({ tracks: z.array(historyTrack).min(1).max(300_000) });

export const historyRoutes = new Hono<UserEnv>()
  .use(requireUser)
  .get('/', (c) => c.json({ history: historySummary(c.var.db, c.var.user.id) }))
  .put('/', zValidator('json', historyBody), (c) => c.json({ history: saveHistory(c.var.db, c.var.user.id, c.req.valid('json').tracks) }))
  .delete('/', (c) => {
    deleteHistory(c.var.db, c.var.user.id);

    return c.json({ history: null });
  });
