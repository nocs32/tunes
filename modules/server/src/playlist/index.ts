import type { Db } from '../db/index.ts';
import type { Env } from '../env.ts';
import { BadRequest } from '../errors.ts';
import {
  addPlaylistItems,
  createPlaylist,
  libraryContains,
  replacePlaylistItems,
  type SpotifyCall,
  spotifyFor,
  updatePlaylistDetails,
} from '../spotify/index.ts';
import { markSent, type Run } from '../suggest/store.ts';
import { getUser, saveSettings, setPlaylistId, type UserSettings } from '../users/index.ts';

// Sending a run to Spotify (D7, D21):
// - rolling (default): one playlist called "Tunes" whose songs are replaced each time. If the
//   person deleted it in Spotify, a new one is made.
// - new: a new playlist per run, named after the mood and the date.
// Songs left out with ✕ are not sent.
// Tunes asks for private playlists, but Spotify ignores `public: false` (checked 2026-11-05, all scopes
// granted, undocumented): new playlists show on the person's profile until they choose
// "Remove from profile" in Spotify. The page says so.

export type PlaylistMode = UserSettings['playlistMode'];

export type Sent = { id: string; name: string; url: string; mode: PlaylistMode; count: number; sentAt: number };

export const rollingName = 'Tunes';

const shortDate = (ms: number): string => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const titleOf = (run: Run): string => (run.mood.length > 60 ? `${run.mood.slice(0, 57)}…` : run.mood) || 'your usual';

const description = (run: Run): string =>
  `Picked by Tunes for “${titleOf(run)}”, ${shortDate(run.createdAt)}. Every song was looked up on Spotify.`;

// Is the rolling playlist still in the person's library? (Deleting a playlist in Spotify only unfollows it.)
const stillThere = async (call: SpotifyCall, playlistId: string): Promise<boolean> => {
  const [saved] = await libraryContains(call, [`spotify:playlist:${playlistId}`]);

  return saved !== false;
};

const sendRolling = async (db: Db, call: SpotifyCall, userId: string, run: Run, uris: string[]): Promise<{ id: string; name: string }> => {
  const details = { name: rollingName, description: description(run) };
  const existing = getUser(db, userId)?.playlistId;

  if (existing && (await stillThere(call, existing))) {
    await updatePlaylistDetails(call, existing, details);
    await replacePlaylistItems(call, existing, uris);

    return { id: existing, name: rollingName };
  }

  const created = await createPlaylist(call, details);

  await addPlaylistItems(call, created.id, uris);
  setPlaylistId(db, userId, created.id);

  return { id: created.id, name: created.name };
};

const sendNew = async (call: SpotifyCall, run: Run, uris: string[]): Promise<{ id: string; name: string }> => {
  const details = { name: `Tunes: ${titleOf(run)}, ${shortDate(run.createdAt)}`, description: description(run) };
  const created = await createPlaylist(call, details);

  await addPlaylistItems(call, created.id, uris);

  return { id: created.id, name: created.name };
};

type SendDeps = { db: Db; env: Env; userId: string };

export const sendRun = async ({ db, env, userId }: SendDeps, run: Run, mode: PlaylistMode): Promise<Sent> => {
  const uris = run.tracks.filter((item) => !item.removed).map((item) => item.track.uri);

  if (uris.length === 0) throw new BadRequest('Every song is left out, so there is nothing to send.');

  const call = spotifyFor(db, env, userId);
  const playlist = mode === 'rolling' ? await sendRolling(db, call, userId, run, uris) : await sendNew(call, run, uris);
  const sentAt = Date.now();

  markSent(db, run.id, { id: playlist.id, name: playlist.name, sentAt });
  saveSettings(db, userId, { ...getUser(db, userId)?.settings, playlistMode: mode });

  return { ...playlist, url: `https://open.spotify.com/playlist/${playlist.id}`, mode, count: uris.length, sentAt };
};
