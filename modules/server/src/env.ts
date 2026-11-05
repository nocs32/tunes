import path from 'node:path';
import { z } from 'zod';

// Settings come from the environment (`.env` at the repo root in dev, the container's env on the Pi).
// Checked once at start, so a missing or broken value stops the server with a clear message.

const repoRoot = path.resolve(import.meta.dirname, '../../..');

const schema = z.object({
  // API_* rather than PORT/HOST: tools that start Vite set PORT for it, and the two must not collide.
  API_PORT: z.coerce.number().int().positive().default(2574),
  // 127.0.0.1 in dev; the container sets 0.0.0.0 so Caddy can reach it.
  API_HOST: z.string().default('127.0.0.1'),
  // Where SQLite keeps its file. In Docker this points into the mounted volume.
  DATABASE_PATH: z.string().default(path.join(repoRoot, 'data', 'tunes.db')),
  // The built web page. Served by this process in production; in dev Vite serves it instead.
  WEB_DIST: z.string().default(path.join(repoRoot, 'modules', 'web', 'dist')),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof schema>;

export const readEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(`Bad environment:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
};
