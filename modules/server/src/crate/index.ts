import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../auth/index.ts';
import { BadRequest } from '../errors.ts';
import { spotifyTrackId } from '../ids.ts';
import { getTrack, spotifyFor } from '../spotify/index.ts';
import { slimTrack } from '../taste/collect.ts';
import { addToCrate, clearCrate, crateLimit, getCrate, removeFromCrate } from './store.ts';

export * from './store.ts';

// /api/crate — every answer is the whole crate: { tracks }.
//   GET    /            the crate
//   POST   /            { trackId } → add a song (looked up on Spotify, so the crate holds real data)
//   DELETE /:trackId    take one song out
//   DELETE /            empty it

const addBody = z.object({ trackId: spotifyTrackId });

export const crateRoutes = new Hono()
  .use(requireUser)
  .get('/', (c) => c.json({ tracks: getCrate(c.var.db, c.var.user.id) }))
  .post('/', zValidator('json', addBody), async (c) => {
    const { db, env, user } = c.var;
    const { trackId } = c.req.valid('json');
    const crate = getCrate(db, user.id);

    if (!crate.some((track) => track.id === trackId)) {
      if (crate.length >= crateLimit) throw new BadRequest(`The crate holds ${crateLimit} songs. Take one out first.`);

      addToCrate(db, user.id, slimTrack(await getTrack(spotifyFor(db, env, user.id), trackId)));
    }

    return c.json({ tracks: getCrate(db, user.id) });
  })
  .delete('/:trackId', (c) => {
    removeFromCrate(c.var.db, c.var.user.id, c.req.param('trackId'));

    return c.json({ tracks: getCrate(c.var.db, c.var.user.id) });
  })
  .delete('/', (c) => {
    clearCrate(c.var.db, c.var.user.id);

    return c.json({ tracks: getCrate(c.var.db, c.var.user.id) });
  });
