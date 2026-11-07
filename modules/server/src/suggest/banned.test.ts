import { describe, expect, it } from 'vitest';
import type { TrackInfo } from '../taste/index.ts';
import { looksRussian } from './banned.ts';
import { selectTracks } from './run.ts';

const track = (id: string, name: string, artist = 'Artist'): TrackInfo => ({
  id,
  uri: `spotify:track:${id}`,
  name,
  artists: [{ id: `a-${id}`, name: artist }],
  album: 'Album',
  imageUrl: null,
  isrc: null,
});

describe('the Russian song check', () => {
  it('goes by letters only Russian uses', () => {
    expect(looksRussian('выхода нет')).toBe(true);
    expect(looksRussian('Лавандовый Город')).toBe(true);
    expect(looksRussian('алёна швец.')).toBe(true);
  });

  it('leaves Ukrainian, Latin and undecidable Cyrillic alone', () => {
    expect(looksRussian('Тисяча пісень')).toBe(false);
    expect(looksRussian('Силуети')).toBe(false);
    expect(looksRussian('Stefania')).toBe(false);
    expect(looksRussian('REVIVƎЯ')).toBe(false);
  });

  it('drops Russian titles and artists from a run with a reason', () => {
    const songs = [track('t1', 'Тисяча пісень', 'KLER'), track('t2', 'выхода нет', 'ksmfx'), track('t3', 'Stay', 'еяхат музыка')];

    const suggestions = songs.map((song) => ({
      artist: song.artists[0]?.name ?? '',
      title: song.name,
      artist_alt: null,
      title_alt: null,
      reason: 'r',
      kind: 'close' as const,
    }));

    const selection = selectTracks(suggestions, songs, { trackUris: [], isrcs: [], artistIds: [] }, 'mixed');

    expect(selection.tracks.map((item) => item.track.name)).toEqual(['Тисяча пісень']);

    expect(selection.dropped.map((item) => [item.title, item.reason])).toEqual([
      ['выхода нет', 'russian'],
      ['Stay', 'russian'],
    ]);
  });
});
