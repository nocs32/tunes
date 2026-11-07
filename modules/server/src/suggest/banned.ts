import type { TrackInfo } from '../taste/index.ts';

// No Russian songs in recommendations (D25, the user's rule). Claude is told so in the system
// prompt; this is the hard check on what Spotify actually returned.
// Going by letters: ы э ё ъ are Russian and not Ukrainian; і ї є ґ are Ukrainian and not Russian.
// A title or artist name with Russian letters and no Ukrainian ones is dropped. Cyrillic with
// neither (Небо, Восемь) can't be told apart by letters and is left to Claude and the user, and so
// are Russian songs with Latin titles.

const russianOnly = /[ыэёъ]/iu;
const ukrainianOnly = /[іїєґ]/iu;

export const looksRussian = (text: string): boolean => russianOnly.test(text) && !ukrainianOnly.test(text);

// Seeds and the crate are the person's own picks and never pass through here.
export const isRussianSong = (track: TrackInfo): boolean => looksRussian(track.name) || track.artists.some((artist) => looksRussian(artist.name));
