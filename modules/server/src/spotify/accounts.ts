import { ReloginNeeded, SpotifyError } from '../errors.ts';
import type { Tokens } from '../users/index.ts';

// Spotify's login server (accounts.spotify.com): Authorization Code with PKCE, no client secret.
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const authorizeEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

// Everything Tunes will ever ask for, so nobody has to log in again when M3/M4 arrive.
export const scopes = [
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-library-modify',
  'user-follow-read',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
];

type AuthorizeParams = { clientId: string; redirectUri: string; state: string; challenge: string };

export const authorizeUrl = ({ clientId, redirectUri, state, challenge }: AuthorizeParams): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  return `${authorizeEndpoint}?${params}`;
};

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string };

const requestTokens = async (form: Record<string, string>): Promise<TokenResponse> => {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });

  if (response.ok) {
    return (await response.json()) as TokenResponse;
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string; error_description?: string };

  // invalid_grant: the code or refresh token is used up, expired (6 months) or revoked.
  if (body.error === 'invalid_grant') throw new ReloginNeeded();

  throw new SpotifyError(response.status, `Spotify login failed: ${body.error_description ?? body.error ?? response.status}`);
};

const toTokens = (response: TokenResponse, previousRefreshToken?: string): Tokens => {
  const refreshToken = response.refresh_token ?? previousRefreshToken;

  if (!refreshToken) throw new SpotifyError(502, 'Spotify sent no refresh token');

  return { accessToken: response.access_token, refreshToken, expiresAt: Date.now() + response.expires_in * 1000 };
};

type ExchangeParams = { code: string; verifier: string; clientId: string; redirectUri: string };

export const exchangeCode = async ({ code, verifier, clientId, redirectUri }: ExchangeParams): Promise<Tokens> => {
  const response = await requestTokens({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });

  return toTokens(response);
};

// A refresh may or may not return a new refresh token; keep the old one if not.
export const refreshTokens = async (refreshToken: string, clientId: string): Promise<Tokens> => {
  const response = await requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });

  return toTokens(response, refreshToken);
};
