import { Hono } from 'hono';
import type { Db } from './db/index.ts';

// What every route can read from its context (`c.var.db`).
export type AppEnv = { Variables: { db: Db } };

// The API lives under /api. The web page calls it through Hono's typed client (`AppType`),
// so a route that changes shape breaks the web build instead of the page.
export const api = new Hono<AppEnv>()
  .basePath('/api')
  .get('/health', (c) => {
    const row = c.var.db.prepare('PRAGMA user_version').get() as { user_version: number };

    return c.json({ ok: true, schema: row.user_version });
  });

export type AppType = typeof api;

// The API with its dependencies plugged in. Used by the server and by tests.
export const createApp = (db: Db): Hono<AppEnv> =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('db', db);
      await next();
    })
    .route('/', api);
