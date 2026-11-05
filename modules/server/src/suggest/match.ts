import type { ArtistRef } from '../taste/collect.ts';

// Deciding whether a Spotify search result is the song Claude meant (spec D16):
// - the artist must match exactly (ignoring case, accents, punctuation and a leading "The"),
//   under either of the names Claude gives (e.g. 米津玄師 / Kenshi Yonezu);
// - the title may differ only in version tags: "(feat. X)", "- 2011 Remaster", "(Live)", "- Speed Up"…
// A suggestion with no matching result is dropped and never shown.

// What Claude names: the song as written, plus the other common spelling when there is one.
export type Wanted = { artist: string; title: string; artistAlt?: string | null; titleAlt?: string | null };

type Candidate = { name: string; artists: ArtistRef[] };

// Words that mark a bracketed part of a title as a version tag rather than part of the name.
const versionTag =
  /\b(feat|ft|featuring|with|remaster|remastered|live|ver|version|edit|mix|remix|mono|stereo|deluxe|bonus|sped|speed|slowed|reverb|radio|extended|instrumental|acoustic|demo|original|from|soundtrack)\b/i;

export const normalize = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /, '');

// "Song (feat. X) - 2011 Remaster" → "song". Brackets without a version word stay:
// "(Don't Fear) The Reaper" keeps its first part.
export const coreTitle = (title: string): string => {
  const withoutSuffix = title.replace(/\s[-–—]\s.*$/u, '');
  const withoutTags = withoutSuffix.replace(/[([（][^)\]）]*[)\]）]/gu, (part) => (versionTag.test(part) ? ' ' : part));

  return normalize(withoutTags) || normalize(title);
};

// "A, B", "A & B", "A feat. B", "A x B" → "A". Only used when the full name doesn't match.
const leadArtist = (name: string): string => name.split(/\s*(?:,|\s&\s|\sfeat\.?\s|\sft\.?\s|\sx\s|\swith\s)\s*/i)[0] ?? name;

const artistNames = (wanted: Wanted): string[] => [wanted.artist, wanted.artistAlt ?? ''].filter(Boolean);

const titles = (wanted: Wanted): string[] => [wanted.title, wanted.titleAlt ?? ''].filter(Boolean);

export const artistMatches = (wanted: string[], artists: ArtistRef[]): boolean => {
  const names = artists.map((artist) => normalize(artist.name));

  return wanted.some((name) => names.includes(normalize(name)) || names.includes(normalize(leadArtist(name))));
};

const hasLatin = (text: string): boolean => /[a-z]/i.test(text.normalize('NFKD'));

// Spotify shows some artists romanized (米津玄師 → Kenshi Yonezu). When Spotify's own artist filter
// returned a result whose name is simply in another script, it's the same artist under its alias.
const sameArtistOtherScript = (wanted: string[], artists: ArtistRef[]): boolean =>
  wanted.every((name) => !hasLatin(name)) && artists.some((artist) => hasLatin(artist.name));

// 3: same title exactly; 2: same core title and no extra tags on Spotify's side;
// 1: same core title (another version); 0: not this song.
const titleScore = (wanted: string, candidate: string): number => {
  if (normalize(wanted) === normalize(candidate)) return 3;

  if (coreTitle(wanted) !== coreTitle(candidate)) return 0;

  return normalize(candidate) === coreTitle(candidate) ? 2 : 1;
};

// The best matching result, preferring exact titles, then originals, then the first-listed artist.
// `artistFiltered`: the results came from a query with Spotify's artist:"…" filter.
export const pickMatch = <T extends Candidate>(wanted: Wanted, results: T[], artistFiltered = false): T | undefined => {
  const names = artistNames(wanted);
  const leads = names.map((name) => normalize(leadArtist(name)));

  const scored = results
    .filter((result) => artistMatches(names, result.artists) || (artistFiltered && sameArtistOtherScript(names, result.artists)))
    .map((result, index) => {
      const lead = leads.includes(normalize(result.artists[0]?.name ?? '')) ? 0.5 : 0;
      const title = Math.max(...titles(wanted).map((name) => titleScore(name, result.name)));

      return { result, index, score: title + lead };
    })
    .filter((entry) => entry.score >= 1);

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  return scored[0]?.result;
};

export type SearchQuery = { q: string; artistFiltered: boolean };

const clean = (text: string): string => text.replace(/["]/g, ' ').replace(/\s+/g, ' ').trim();

const withoutSuffix = (title: string): string => title.replace(/\s[-–—]\s.*$/u, '');

// The search queries to try, strictest first: field filters, then plain words; each with the
// names as written, then with the other spelling.
export const searchQueries = (wanted: Wanted): SearchQuery[] => {
  const pairs = [
    [wanted.title, wanted.artist],
    [wanted.titleAlt ?? wanted.title, wanted.artistAlt ?? wanted.artist],
  ];

  const strict = pairs.map(([title = '', artist = '']) => ({
    q: `track:"${clean(title)}" artist:"${clean(leadArtist(artist))}"`,
    artistFiltered: true,
  }));

  const loose = pairs.map(([title = '', artist = '']) => ({
    q: `${clean(withoutSuffix(title))} ${clean(leadArtist(artist))}`,
    artistFiltered: false,
  }));

  const seen = new Set<string>();

  return [...strict, ...loose].filter((query) => !seen.has(query.q) && seen.add(query.q));
};
