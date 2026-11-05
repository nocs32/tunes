import { Hono } from 'hono';
import { authRoutes, requireUser } from './auth/index.ts';
import type { AppEnv } from './context.ts';
import type { Db } from './db/index.ts';
import type { Env } from './env.ts';
import { handleError } from './errors.ts';
import { createClaude, runRoutes, type SuggestClient } from './suggest/index.ts';
import { tasteRoutes } from './taste/index.ts';

export type { AppEnv, UserEnv } from './context.ts';

const meRoutes = new Hono().use(requireUser).get('/', (c) => {
  const { id, displayName, imageUrl } = c.var.user;

  return c.json({ id, displayName, imageUrl });
});

// The API lives under /api. The web page calls it through Hono's typed client (`AppType`),
// so a route that changes shape breaks the web build instead of the page.
export const api = new Hono<AppEnv>()
  .basePath('/api')
  .get('/health', (c) => {
    const row = c.var.db.prepare('PRAGMA user_version').get() as { user_version: number };

    return c.json({ ok: true, schema: row.user_version });
  })
  .route('/auth', authRoutes)
  .route('/me', meRoutes)
  .route('/taste', tasteRoutes)
  .route('/runs', runRoutes);

export type AppType = typeof api;

// The API with its dependencies plugged in. Used by the server and by tests.
export const createApp = (db: Db, env: Env, claude: SuggestClient = createClaude(env.ANTHROPIC_API_KEY)): Hono<AppEnv> =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('db', db);
      c.set('env', env);
      c.set('claude', claude);
      await next();
    })
    .route('/', api)
    .onError(handleError);
