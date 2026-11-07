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
    expect(looksRussian('Белый дым')).toBe(true);
    expect(looksRussian('Это всё')).toBe(true);
    expect(looksRussian('Подъезд')).toBe(true);
  });

  it('leaves Ukrainian, Latin and undecidable Cyrillic alone', () => {
    expect(looksRussian('Співай зі мною')).toBe(false);
    expect(looksRussian('Небо')).toBe(false);
    expect(looksRussian('Summer Rain')).toBe(false);
    expect(looksRussian('BACKWARDƎЯ')).toBe(false);
  });

  it('drops Russian titles and artists from a run with a reason', () => {
    const songs = [track('t1', 'Співай зі мною', 'Band One'), track('t2', 'Белый дым', 'Band Two'), track('t3', 'Stay', 'Тёмный')];

    const suggestions = songs.map((song) => ({
      artist: song.artists[0]?.name ?? '',
      title: song.name,
      artist_alt: null,
      title_alt: null,
      reason: 'r',
      kind: 'close' as const,
    }));

    const selection = selectTracks(suggestions, songs, { trackUris: [], isrcs: [], artistIds: [] }, 'mixed');

    expect(selection.tracks.map((item) => item.track.name)).toEqual(['Співай зі мною']);

    expect(selection.dropped.map((item) => [item.title, item.reason])).toEqual([
      ['Белый дым', 'russian'],
      ['Stay', 'russian'],
    ]);
  });
});
