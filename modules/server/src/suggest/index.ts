import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../auth/index.ts';
import type { UserEnv } from '../context.ts';
import { NotFound } from '../errors.ts';
import { sendRun } from '../playlist/index.ts';
import { discoveryLevels } from './prompt.ts';
import { createRun } from './run.ts';
import { getRun, latestRun, type Run, setRemoved } from './store.ts';

export * from './claude.ts';
export type { Discovery } from './prompt.ts';
export type { Run, RunTrack } from './store.ts';

// /api/runs — suggestion runs.
//   POST /                         { mood, discovery } → a new run (takes a minute or two)
//   POST /:id/refine               { note } → a new run that follows the note
//   GET  /latest                   → { run } or { run: null }
//   PUT  /:id/tracks/:position     { removed } → take a song out of the list, or put it back
//   POST /:id/playlist             { mode: rolling | new } → send the list to a Spotify playlist

const runBody = z.object({
  mood: z.string().trim().max(300).default(''),
  discovery: z.enum(discoveryLevels),
});

const refineBody = z.object({ note: z.string().trim().min(1).max(300) });

const removedBody = z.object({ removed: z.boolean() });

const playlistBody = z.object({ mode: z.enum(['rolling', 'new']) });

const ownRun = (c: Context<UserEnv>): Run => {
  const run = getRun(c.var.db, c.var.user.id, Number(c.req.param('id')));

  if (!run) throw new NotFound('That run doesn’t exist.');

  return run;
};

const deps = (c: Context<UserEnv>): Parameters<typeof createRun>[0] => ({
  db: c.var.db,
  env: c.var.env,
  claude: c.var.claude,
  userId: c.var.user.id,
});

export const runRoutes = new Hono()
  .use(requireUser)
  .post('/', zValidator('json', runBody), async (c) => c.json(await createRun(deps(c), c.req.valid('json'))))
  .get('/latest', (c) => c.json({ run: latestRun(c.var.db, c.var.user.id) ?? null }))
  .post('/:id/refine', zValidator('json', refineBody), async (c) => {
    const parent = ownRun(c);
    const input = { mood: parent.mood, discovery: parent.discovery, refineOf: parent, note: c.req.valid('json').note };

    return c.json(await createRun(deps(c), input));
  })
  .put('/:id/tracks/:position', zValidator('json', removedBody), (c) => {
    const run = ownRun(c);

    setRemoved(c.var.db, run.id, Number(c.req.param('position')), c.req.valid('json').removed);

    return c.json({ ok: true });
  })
  .post('/:id/playlist', zValidator('json', playlistBody), async (c) => {
    const sent = await sendRun({ db: c.var.db, env: c.var.env, userId: c.var.user.id }, ownRun(c), c.req.valid('json').mode);

    return c.json(sent);
  });
