import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// Errors the page knows how to explain. Every error response is `{ error: code, message }`.

// The Spotify login is gone (refresh token expired or revoked): log in again.
export class ReloginNeeded extends Error {
  constructor() {
    super('Your Spotify login expired. Please log in again.');
  }
}

// Spotify answered with an error we can't fix by waiting.
export class SpotifyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Spotify keeps saying "too many requests". `quota` is the Development Mode quota (no wait time given).
export class SpotifyBusy extends Error {
  readonly quota: boolean;

  constructor(quota: boolean) {
    super(
      quota
        ? 'Spotify’s request limit for this app is used up for now. Try again later.'
        : 'Spotify is rate-limiting us. Try again in a minute.',
    );

    this.quota = quota;
  }
}

// Claude declined the request (stop_reason "refusal"). The page shows why and offers Retry (D18).
export class ClaudeRefused extends Error {
  readonly category: string | null;

  constructor(category: string | null, explanation: string | null) {
    super(
      `Claude declined this run${category ? ` (${category})` : ''}.${explanation ? ` ${explanation}` : ''} You can retry, or change the mood text.`,
    );

    this.category = category;
  }
}

export class NotFound extends Error {}

// Claude couldn't answer usefully: no API key, an API error, or an unusable answer.
export class ClaudeFailed extends Error {}

type ErrorBody = { error: string; message: string };

const describe = (error: Error): [ContentfulStatusCode, ErrorBody] => {
  if (error instanceof ReloginNeeded) return [401, { error: 'relogin', message: error.message }];

  if (error instanceof SpotifyBusy) return [503, { error: 'spotify_busy', message: error.message }];

  if (error instanceof SpotifyError && error.status === 403) {
    const message = 'Spotify refused. Is this account on the app’s user list in the Spotify dashboard?';

    return [403, { error: 'spotify_forbidden', message }];
  }

  if (error instanceof SpotifyError) return [502, { error: 'spotify', message: error.message }];

  if (error instanceof ClaudeRefused) return [422, { error: 'claude_refused', message: error.message }];

  if (error instanceof ClaudeFailed) return [502, { error: 'claude', message: error.message }];

  if (error instanceof NotFound) return [404, { error: 'not_found', message: error.message }];

  return [500, { error: 'server', message: 'Something went wrong on the server.' }];
};

export const handleError = (error: Error, c: Context): Response => {
  const [status, body] = describe(error);

  if (status >= 500) {
    console.error(error);
  }

  return c.json(body, status);
};
