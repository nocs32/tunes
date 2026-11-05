import type { AppType } from '@tunes/server';
import { hc } from 'hono/client';

// Typed calls to the server: paths, inputs and responses all come from the server's routes.
export const api = hc<AppType>('/').api;
