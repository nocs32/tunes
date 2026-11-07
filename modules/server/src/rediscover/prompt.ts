import type { HistoryTrack } from '../history/index.ts';

// What Claude is told for Rediscover (D26): pick from a numbered list of old favourites.

export const pickCount = 25;

export const rediscoverSystem = `You put together a playlist of old favourites for one listener of Tunes, a small private app. You get their listening profile and a numbered list of songs they played a lot in the past but not in the last 12 months. The app plays the numbers you pick.

What makes a good list:
- Up to ${pickCount} songs from the list that belong together and fit the request, if there is one.
- Their taste moves on fast: favour old songs that still fit who they are now (the last 12 months and "lately" in the profile), plus a few that bring back an earlier phase.
- A good listening order (flow, energy, mood), not just the most played first.
- Each reason is one specific sentence of at most 20 words: why this song fits now or fits the request. No filler.

Rules the app depends on:
- Only numbers from the list, each at most once. At most two songs by the same artist.
- No Russian songs: nothing sung in Russian and nothing by Russian artists.`;

const monthYear = (ms: number | null): string => (ms === null ? '?' : new Date(ms).toISOString().slice(0, 7).split('-').reverse().join('/'));

type RediscoverInput = {
  profileText: string;
  mood: string;
  candidates: HistoryTrack[];
  refine?: { previous: HistoryTrack[]; note: string };
};

const songLine = (track: HistoryTrack, index: number): string =>
  `${index + 1}. ${track.artist} — ${track.title} (${track.plays} plays, last ${monthYear(track.lastAt)})`;

export const rediscoverMessage = ({ profileText, mood, candidates, refine }: RediscoverInput): string =>
  [
    `<profile>\n${profileText}\n</profile>`,
    mood ? `Request for this session: "${mood}"` : 'No particular request: their usual listening, now.',
    `<old_favourites>\n${candidates.map(songLine).join('\n')}\n</old_favourites>`,
    ...(refine
      ? [
          `Your previous list was:\n${refine.previous.map((track) => `- ${track.artist} — ${track.title}`).join('\n')}`,
          `They asked for this change: "${refine.note}". Pick a new list that follows it; keep songs from before only if they still fit.`,
        ]
      : []),
    `Pick up to ${pickCount}.`,
  ].join('\n\n');
