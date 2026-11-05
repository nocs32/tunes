import type { TimeRange } from '../spotify/types.ts';
import type { TasteProfile } from './profile.ts';

// The profile as Claude reads it: short plain text, a few thousand tokens at most.
// The page shows exactly this under "What Claude sees".

type ProfileInput = Omit<TasteProfile, 'promptText'>;

const rankLabel = (ranks: Partial<Record<TimeRange, number>>): string =>
  (['short_term', 'medium_term', 'long_term'] as const).map((range) => (ranks[range] ? `#${ranks[range]}` : '–')).join(' / ');

const artistLines = (profile: ProfileInput): string[] =>
  profile.artists.map((artist, index) => {
    const genres = artist.genres.length ? `; ${artist.genres.slice(0, 3).join(', ')}` : '';

    return `${index + 1}. ${artist.name} — ${artist.trend} (${rankLabel(artist.ranks)}${genres})`;
  });

const trackLines = (profile: ProfileInput): string[] =>
  profile.tracks.map((track) => `- ${track.artists.map((artist) => artist.name).join(', ')} — ${track.name}`);

export const promptText = (profile: ProfileInput): string => {
  const { counts } = profile;

  const sections = [
    'TOP ARTISTS (rank in the last 4 weeks / 6 months / 1 year; rising = new lately, older = only in the 1-year list)',
    ...artistLines(profile),
    '',
    'REPRESENTATIVE TRACKS (from the three top-track lists)',
    ...trackLines(profile),
    '',
    `RECENT PLAYS (last ${counts.recentPlays}), most-played artists: ${profile.recentArtists.map((a) => `${a.name} ×${a.plays}`).join(', ') || 'none'}`,
    `LIBRARY: ${counts.saved} saved tracks, ${counts.followed} followed artists`,
  ];

  if (profile.genres.length) {
    sections.push(`GENRES (from Spotify's artist tags): ${profile.genres.map((genre) => genre.name).join(', ')}`);
  }

  return sections.join('\n');
};
