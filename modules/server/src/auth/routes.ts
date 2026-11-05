import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import type { AppEnv } from '../context.ts';
import type { Env } from '../env.ts';
import { authorizeUrl, exchangeCode, getMe, spotifyFetch } from '../spotify/index.ts';
import { saveLogin } from '../users/index.ts';
import { challengeFor, createVerifier, randomToken } from './crypto.ts';
import { createSession, deleteSession, sessionCookie, sessionMaxAgeSeconds } from './sessions.ts';

// Login, step by step:
// 1. /api/auth/login makes a random `state` and a PKCE verifier, keeps both in a short-lived
//    cookie, and sends the browser to Spotify.
// 2. The person agrees on Spotify, which sends the browser to /api/auth/callback with a code.
// 3. We check `state` (the request really started here), swap the code + verifier for tokens,
//    read who they are, store the encrypted tokens, and start a session.

const oauthCookie = 'tunes_oauth';

const redirectUri = (env: Env): string => `${env.PUBLIC_URL}/api/auth/callback`;

const cookieOptions = (env: Env, maxAge: number, path = '/'): CookieOptions => ({
  httpOnly: true,
  sameSite: 'Lax',
  secure: env.PUBLIC_URL.startsWith('https://'),
  path,
  maxAge,
});

const startLogin = (c: Context<AppEnv>): Response => {
  const { env } = c.var;
  const state = randomToken(16);
  const verifier = createVerifier();

  setCookie(c, oauthCookie, `${state}.${verifier}`, cookieOptions(env, 600, '/api/auth'));

  return c.redirect(
    authorizeUrl({ clientId: env.SPOTIFY_CLIENT_ID, redirectUri: redirectUri(env), state, challenge: challengeFor(verifier) }),
  );
};

// The verifier from step 1, if this callback really belongs to a login we started.
const takeVerifier = (c: Context<AppEnv>): string | undefined => {
  const [state, verifier] = (getCookie(c, oauthCookie) ?? '').split('.');

  deleteCookie(c, oauthCookie, { path: '/api/auth' });

  return state && state === c.req.query('state') ? verifier : undefined;
};

const finishLogin = async (c: Context<AppEnv>): Promise<Response> => {
  const { db, env } = c.var;
  const verifier = takeVerifier(c);
  const code = c.req.query('code');

  if (c.req.query('error')) return c.redirect('/?login=denied');

  if (!verifier || !code) return c.redirect('/?login=failed');

  const tokens = await exchangeCode({ code, verifier, clientId: env.SPOTIFY_CLIENT_ID, redirectUri: redirectUri(env) });
  const me = await getMe((path) => spotifyFetch(tokens.accessToken, path));
  const imageUrl = me.images?.[0]?.url ?? null;
  const user = saveLogin(db, { id: me.id, displayName: me.display_name ?? me.id, imageUrl, tokens }, env.TOKEN_KEY);

  setCookie(c, sessionCookie, createSession(db, user.id), cookieOptions(env, sessionMaxAgeSeconds));

  return c.redirect('/');
};

const logout = (c: Context<AppEnv>): Response => {
  const id = getCookie(c, sessionCookie);

  if (id) deleteSession(c.var.db, id);

  deleteCookie(c, sessionCookie, { path: '/' });

  return c.json({ ok: true });
};

export const authRoutes = new Hono<AppEnv>()
  .get('/login', startLogin)
  .get('/callback', async (c) => finishLogin(c).catch(() => c.redirect('/?login=failed')))
  .post('/logout', logout);
