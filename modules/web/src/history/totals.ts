import { readZip } from './zip.ts';

// Spotify's extended streaming history → per-song totals, in the browser. Only these totals are
// sent to Tunes: each play's time, IP address, device and country stay on this computer.

export type HistoryTrack = {
  uri: string;
  artist: string;
  title: string;
  plays: number;
  skips: number;
  finishes: number;
  firstAt: number | null;
  lastAt: number | null;
  months: Record<string, number>;
};

// The fields Tunes reads from each play.
type Play = {
  ts?: string;
  ms_played?: number;
  spotify_track_uri?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_track_name?: string | null;
  skipped?: boolean | null;
  reason_end?: string | null;
};

// A play counts from 30 seconds, like Spotify's own stats.
const minPlayMs = 30_000;

const audioFile = /Streaming_History_Audio[^/]*\.json$/i;

const emptyTrack = (play: Play, uri: string): HistoryTrack => ({
  uri,
  artist: play.master_metadata_album_artist_name ?? '',
  title: play.master_metadata_track_name ?? '',
  plays: 0,
  skips: 0,
  finishes: 0,
  firstAt: null,
  lastAt: null,
  months: {},
});

const addPlay = (tracks: Map<string, HistoryTrack>, play: Play): void => {
  const uri = play.spotify_track_uri;
  const at = play.ts ? Date.parse(play.ts) : NaN;

  if (!uri?.startsWith('spotify:track:') || Number.isNaN(at)) return;

  const track = tracks.get(uri) ?? emptyTrack(play, uri);

  tracks.set(uri, track);

  if (play.skipped || play.reason_end === 'fwdbtn') track.skips++;

  if (play.reason_end === 'trackdone') track.finishes++;

  if ((play.ms_played ?? 0) < minPlayMs) return;

  const month = new Date(at).toISOString().slice(0, 7);

  track.plays++;
  track.months[month] = (track.months[month] ?? 0) + 1;
  track.firstAt = track.firstAt === null ? at : Math.min(track.firstAt, at);
  track.lastAt = track.lastAt === null ? at : Math.max(track.lastAt, at);
};

export const historyTotals = async (zip: Blob): Promise<HistoryTrack[]> => {
  const files = (await readZip(zip)).filter((file) => audioFile.test(file.name));

  if (files.length === 0) {
    throw new Error('No Streaming_History_Audio files in that zip. Tunes needs the “Extended streaming history” export, not the basic account data.');
  }

  const tracks = new Map<string, HistoryTrack>();

  for (const file of files) {
    (JSON.parse(await file.read()) as Play[]).forEach((play) => addPlay(tracks, play));
  }

  // Songs only ever skipped within seconds still count for the skip rule; the rest carry nothing.
  return [...tracks.values()].filter((track) => track.plays > 0 || track.skips > 0);
};
