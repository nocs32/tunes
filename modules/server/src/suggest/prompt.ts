// What Claude is told. The system prompt is the same for every run; the user message carries
// this listener's profile and this run's request.

export type Discovery = 'close' | 'mixed' | 'adventurous';

export const discoveryLevels: readonly Discovery[] = ['close', 'mixed', 'adventurous'];

export const system = `You suggest music to one listener of Tunes, a small private app. You get their listening profile from Spotify and, sometimes, a request for this session. Your list goes into a Spotify playlist after the app looks up every song on Spotify.

What makes a good list:
- Songs this listener most likely doesn't know yet and will want to keep.
- Go by what their artists and tracks actually sound like, not by genre labels. This listener moves freely between scenes, styles and languages, so look for connections across them (sound, energy, mood, production, vocals, scene) instead of staying inside one genre.
- Many of their artists are small or recent. When you don't know an artist well, reason from the track titles, the artists around it in the profile, and what you do know. Never make up facts about an artist.
- Their thumbs up and down on earlier suggestions (at the end of the profile) are the clearest signal of all: lean toward what they liked and away from what they disliked.
- Mostly close matches, plus a few wildcards (about one in five) that stretch their taste in a direction the profile hints at. Mark each one's kind.
- Each reason is one specific sentence of at most 20 words that names what the song shares with something in their profile (an artist, a track or a quality). No filler such as "you'll love this".
- Best picks first.

Rules the app depends on:
- Only real, released songs you are confident are on Spotify. Write the primary artist and the song title in their original script (for example 米津玄師, 廻廻奇譚). Name a version (for example "- Sped Up") only when you mean that version.
- Spotify sometimes shows a romanized or English name instead (Kenshi Yonezu, Kaikai Kitan). When an artist or title has such another common spelling, give it in artist_alt / title_alt; otherwise use null.
- One song per entry, no albums. At most two songs by the same artist.
- Never suggest songs listed in the profile or in the avoid list.`;

const discoveryText: Record<Discovery, string> = {
  close: 'Close: favour songs they probably haven\'t heard by artists they already play, and very close neighbours of those artists.',
  mixed: 'Mixed: about a third from artists they already play, the rest from artists new to them.',
  adventurous: 'Adventurous: only artists who appear nowhere in the profile.',
};

export type PromptInput = {
  profileText: string;
  discovery: Discovery;
  mood: string;
  count: number;
  avoid: { artist: string; title: string }[];
  refine?: { previous: { artist: string; title: string }[]; note: string };
  seeds?: { artist: string; title: string }[];
};

const songLines = (songs: { artist: string; title: string }[]): string =>
  songs.map((song) => `- ${song.artist} — ${song.title}`).join('\n');

// "More like this" / the crate: the whole list is built around songs the listener picked.
const seedText = (seeds: { artist: string; title: string }[]): string =>
  seeds.length === 1
    ? [
        `They asked for more like this song: ${seeds[0]?.artist} — ${seeds[0]?.title}`,
        'Build the whole list around it: songs that share its sound, energy and feel. Use the profile to choose among those, not to drift away from the song.',
        'The app adds this song itself, so leave it out of your list.',
      ].join('\n')
    : [
        'They picked these songs and asked for more like them:',
        songLines(seeds),
        'Build the whole list around what these songs share (sound, energy, feel), and cover the range between them rather than following only one. Use the profile to choose among those, not to drift away from these songs.',
        'The app adds these songs itself, so leave them out of your list.',
      ].join('\n');

export const userMessage = ({ profileText, discovery, mood, count, avoid, refine, seeds = [] }: PromptInput): string => {
  const parts = [
    `<profile>\n${profileText}\n</profile>`,
    `Discovery level: ${discoveryText[discovery]}`,
    mood.trim()
      ? `Request for this session: "${mood.trim()}"`
      : 'No specific request this time: suggest from their overall taste.',
  ];

  if (seeds.length) parts.push(`<seed>\n${seedText(seeds)}\n</seed>`);

  if (avoid.length) parts.push(`<avoid reason="suggested to them recently">\n${songLines(avoid)}\n</avoid>`);

  if (refine) {
    parts.push(`<previous_list>\n${songLines(refine.previous)}\n</previous_list>`);
    parts.push(`Their note on that list: "${refine.note.trim()}"`);
    parts.push(`Make a new list of ${count} songs that follows the note. Keep songs from the previous list only if they still fit.`);
  } else {
    parts.push(`Suggest ${count} songs.`);
  }

  return parts.join('\n\n');
};
