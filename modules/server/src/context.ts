import type { Db } from './db/index.ts';
import type { Env } from './env.ts';
import type { SuggestClient } from './suggest/claude.ts';
import type { User } from './users/index.ts';

// What every route can read from its context: `c.var.db`, `c.var.env`, `c.var.claude`.
export type AppVars = { db: Db; env: Env; claude: SuggestClient };
export type AppEnv = { Variables: AppVars };

// Routes behind `requireUser` also get the logged-in user: `c.var.user`.
export type UserEnv = { Variables: AppVars & { user: User } };
