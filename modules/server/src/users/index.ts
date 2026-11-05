import { encrypt } from '../auth/crypto.ts';
import type { Db } from '../db/index.ts';

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

// Tokens stay encrypted in this object; `decrypt` them only right before a Spotify call.
export type User = {
  id: string;
  displayName: string;
  imageUrl: string | null;
  sealedAccessToken: string;
  sealedRefreshToken: string;
  tokenExpiresAt: number;
  authorizedAt: number;
  playlistId: string | null;
};

type UserRow = {
  id: string;
  display_name: string;
  image_url: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  authorized_at: number;
  playlist_id: string | null;
};

const fromRow = (row: UserRow): User => ({
  id: row.id,
  displayName: row.display_name,
  imageUrl: row.image_url,
  sealedAccessToken: row.access_token,
  sealedRefreshToken: row.refresh_token,
  tokenExpiresAt: row.token_expires_at,
  authorizedAt: row.authorized_at,
  playlistId: row.playlist_id,
});

export const getUser = (db: Db, id: string): User | undefined => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;

  return row && fromRow(row);
};

export type Login = { id: string; displayName: string; imageUrl: string | null; tokens: Tokens };

// A fresh login: new tokens, and the 6-month refresh-token clock restarts.
export const saveLogin = (db: Db, login: Login, key: string): User => {
  const now = Date.now();

  db.prepare(
    `INSERT INTO users (id, display_name, image_url, access_token, refresh_token, token_expires_at,
                        authorized_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       display_name = excluded.display_name, image_url = excluded.image_url,
       access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       token_expires_at = excluded.token_expires_at, authorized_at = excluded.authorized_at,
       updated_at = excluded.updated_at`,
  ).run(
    login.id,
    login.displayName,
    login.imageUrl,
    encrypt(login.tokens.accessToken, key),
    encrypt(login.tokens.refreshToken, key),
    login.tokens.expiresAt,
    now,
    now,
    now,
  );

  return getUser(db, login.id) as User;
};

// After a refresh: same login, new tokens.
export const saveTokens = (db: Db, userId: string, tokens: Tokens, key: string): void => {
  db.prepare('UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?').run(
    encrypt(tokens.accessToken, key),
    encrypt(tokens.refreshToken, key),
    tokens.expiresAt,
    Date.now(),
    userId,
  );
};
