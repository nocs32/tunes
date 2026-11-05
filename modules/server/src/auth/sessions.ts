import type { Db } from '../db/index.ts';
import { randomToken } from './crypto.ts';

// A login session is a random id in an httpOnly cookie, mapped to a user here.
// It outlives a browser restart; Spotify's own refresh token (6 months) is the real limit.

export const sessionCookie = 'tunes_session';
export const sessionMaxAgeSeconds = 90 * 24 * 60 * 60;

export const createSession = (db: Db, userId: string): string => {
  const id = randomToken();
  const now = Date.now();

  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    now,
    now + sessionMaxAgeSeconds * 1000,
  );

  return id;
};

export const findSessionUserId = (db: Db, id: string): string | undefined => {
  const row = db.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?').get(id, Date.now()) as
    | { user_id: string }
    | undefined;

  return row?.user_id;
};

export const deleteSession = (db: Db, id: string): void => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
};

// When Spotify says the login is dead, every browser of that user goes back to the login page.
export const deleteUserSessions = (db: Db, userId: string): void => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
};
