import type { AppType } from '@tunes/server';
import { hc, type InferResponseType } from 'hono/client';

// Typed calls to the server: paths, inputs and responses all come from the server's routes.
export const api = hc<AppType>('/').api;

export type Me = InferResponseType<typeof api.me.$get, 200>;
export type Taste = InferResponseType<typeof api.taste.$get, 200>;
export type Profile = Taste['profile'];
export type Run = InferResponseType<(typeof api.runs)[':id']['$get'], 200>;
export type RunTrack = Run['tracks'][number];
export type RunSummary = InferResponseType<typeof api.runs.$get, 200>['runs'][number];
export type Discovery = Run['discovery'];
export type PlaylistMode = Me['playlistMode'];

// Every server error is `{ error, message }`; `code` says what kind (e.g. "relogin").
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Codes after which the person has to log in (again).
export const isLoggedOut = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.code === 'logged_out' || error.code === 'relogin');

type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };

// A route's success body: the JSON it can return, minus the validator's 400 reply.
type Success<R> = Exclude<R extends { json: () => Promise<infer J> } ? J : never, { success: false }>;

// The response's JSON, or an ApiError with the server's message.
export const unwrap = async <R extends Reply>(request: Promise<R>): Promise<Success<R>> => {
  const response = await request.catch(() => {
    throw new ApiError('network', 'Can’t reach the Tunes server.');
  });

  if (response.ok) return (await response.json()) as Success<R>;

  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

  throw new ApiError(body.error ?? 'server', body.message ?? `Request failed (${response.status}).`);
};
