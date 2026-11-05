import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { UserEnv } from '../context.ts';
import { getUser } from '../users/index.ts';
import { findSessionUserId, sessionCookie } from './sessions.ts';

export { authRoutes } from './routes.ts';
export * from './sessions.ts';

// Lets a route through only with a live session, and gives it `c.var.user`.
export const requireUser = createMiddleware<UserEnv>(async (c, next) => {
  const sessionId = getCookie(c, sessionCookie);
  const userId = sessionId ? findSessionUserId(c.var.db, sessionId) : undefined;
  const user = userId ? getUser(c.var.db, userId) : undefined;

  if (!user) {
    return c.json({ error: 'logged_out', message: 'Not logged in.' }, 401);
  }

  c.set('user', user);
  await next();
});
