import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../auth/index.ts';
import type { UserEnv } from '../context.ts';
import { NotFound } from '../errors.ts';
import { setVote } from '../feedback/index.ts';
import { getJob, startJob } from '../jobs/index.ts';
import { sendRun } from '../playlist/index.ts';
import { discoveryLevels } from './prompt.ts';
import { createRun } from './run.ts';
import { getRun, latestRun, listRuns, type Run, setRemoved } from './store.ts';

export * from './claude.ts';
export type { Discovery } from './prompt.ts';
export type { Run, RunTrack } from './store.ts';

// /api/runs — suggestion runs.
//   POST /                         { mood, discovery, seedTrackId? } → { jobId }: a new run, started in the background
//   POST /:id/refine               { note } → { jobId }: a new run that follows the note
//   GET  /jobs/:jobId              → { status: running | done (with run) | failed (with error) }
//   GET  /                         → { runs }: earlier runs, newest first
//   GET  /latest                   → { run } or { run: null }
//   GET  /:id                      → one run
//   PUT  /:id/tracks/:position/vote  { vote: up | down | null } → thumbs up / down, or take it back
//   PUT  /:id/tracks/:position     { removed } → take a song out of the list, or put it back
//   POST /:id/playlist             { mode: rolling | new } → send the list to a Spotify playlist

const runBody = z.object({
  mood: z.string().trim().max(300).default(''),
  discovery: z.enum(discoveryLevels),
  // "More like this": a Spotify track id (22 letters and digits).
  seedTrackId: z.string().regex(/^[A-Za-z0-9]{22}$/).optional(),
});

const refineBody = z.object({ note: z.string().trim().min(1).max(300) });

const removedBody = z.object({ removed: z.boolean() });

const playlistBody = z.object({ mode: z.enum(['rolling', 'new']) });

const voteBody = z.object({ vote: z.enum(['up', 'down']).nullable() });

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
  .post('/', zValidator('json', runBody), (c) => {
    const input = c.req.valid('json');

    return c.json({ jobId: startJob(c.var.user.id, () => createRun(deps(c), input)) }, 202);
  })
  .get('/jobs/:jobId', (c) => {
    const job = getJob<Run>(c.req.param('jobId'), c.var.user.id);

    if (!job) throw new NotFound('That run is no longer known to the server (it may have restarted). Please retry.');

    return c.json(job);
  })
  .get('/', (c) => c.json({ runs: listRuns(c.var.db, c.var.user.id) }))
  .get('/latest', (c) => c.json({ run: latestRun(c.var.db, c.var.user.id) ?? null }))
  .get('/:id', (c) => c.json(ownRun(c)))
  .post('/:id/refine', zValidator('json', refineBody), (c) => {
    const parent = ownRun(c);
    const input = { mood: parent.mood, discovery: parent.discovery, refineOf: parent, note: c.req.valid('json').note };

    return c.json({ jobId: startJob(c.var.user.id, () => createRun(deps(c), input)) }, 202);
  })
  .put('/:id/tracks/:position', zValidator('json', removedBody), (c) => {
    const run = ownRun(c);

    setRemoved(c.var.db, run.id, Number(c.req.param('position')), c.req.valid('json').removed);

    return c.json({ ok: true });
  })
  .put('/:id/tracks/:position/vote', zValidator('json', voteBody), (c) => {
    const run = ownRun(c);
    const item = run.tracks.find((entry) => entry.position === Number(c.req.param('position')));

    if (!item) throw new NotFound('That song isn’t in this run.');

    setVote(c.var.db, c.var.user.id, item.track, c.req.valid('json').vote, run.id);

    return c.json({ vote: c.req.valid('json').vote });
  })
  .post('/:id/playlist', zValidator('json', playlistBody), async (c) => {
    const sent = await sendRun({ db: c.var.db, env: c.var.env, userId: c.var.user.id }, ownRun(c), c.req.valid('json').mode);

    return c.json(sent);
  });
