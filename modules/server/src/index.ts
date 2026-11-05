import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { openDb } from './db/index.ts';
import { readEnv } from './env.ts';

const env = readEnv();
const db = openDb(env.DATABASE_PATH);
const app = createApp(db, env);

// In production this process also serves the built page; any unknown path gets index.html
// so the page's own router can handle it. In dev, Vite serves the page and forwards /api here.
if (env.NODE_ENV === 'production') {
  const root = path.relative(process.cwd(), env.WEB_DIST);
  const indexHtml = fs.readFileSync(path.join(env.WEB_DIST, 'index.html'), 'utf8');

  app.use('/*', serveStatic({ root }));
  app.get('/*', (c) => c.html(indexHtml));
}

const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST }, (info) => {
  console.log(`Tunes server on http://${env.API_HOST}:${info.port} (${env.NODE_ENV})`);
});

const shutDown = (): void => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
