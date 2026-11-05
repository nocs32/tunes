import type { AppType } from '@tunes/server';
import { hc, type InferResponseType } from 'hono/client';

// Typed calls to the server: paths, inputs and responses all come from the server's routes.
export const api = hc<AppType>('/').api;

export type Me = InferResponseType<typeof api.me.$get, 200>;
export type Taste = InferResponseType<typeof api.taste.$get, 200>;
export type Profile = Taste['profile'];

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

// The response's JSON, or an ApiError with the server's message.
export const unwrap = async <T>(request: Promise<{ ok: boolean; status: number; json: () => Promise<T> }>): Promise<T> => {
  const response = await request.catch(() => {
    throw new ApiError('network', 'Can’t reach the Tunes server.');
  });

  if (response.ok) return response.json();

  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

  throw new ApiError(body.error ?? 'server', body.message ?? `Request failed (${response.status}).`);
};
