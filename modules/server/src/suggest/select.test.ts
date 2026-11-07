import { describe, expect, it } from 'vitest';
import { historyFilters } from '../history/index.ts';
import { historyTrack } from '../history/testing.ts';
import type { TrackInfo } from '../taste/index.ts';
import { selectTracks } from './run.ts';

const track = (id: string, artist: string, artistId = `id-${artist}`): TrackInfo => ({
  id,
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  artists: [{ id: artistId, name: artist }],
  album: 'Album',
  imageUrl: null,
  isrc: null,
});

const asSuggestions = (songs: TrackInfo[]): Parameters<typeof selectTracks>[0] =>
  songs.map((song) => ({ artist: song.artists[0]?.name ?? '', title: song.name, artist_alt: null, title_alt: null, reason: 'r', kind: 'close' }));

const noneKnown = { trackUris: [], isrcs: [], artistIds: [] };
const noVotes = { up: new Set<string>(), down: new Set<string>() };

// The history: one song played a lot by "Old Band", one only ever skipped.
const history = historyFilters([
  historyTrack(1, 'Old Band', { '2024-02': 12 }),
  historyTrack(2, 'Skippy', {}, { plays: 0, skips: 5, finishes: 0 }),
]);

const reasons = (selection: ReturnType<typeof selectTracks>): string[][] => selection.dropped.map((item) => [item.title, item.reason]);

describe('choosing a run’s songs with the history', () => {
  it('drops songs you keep skipping and labels songs from the history as known', () => {
    const songs = [track('Hist000000000000000001', 'Old Band'), track('Hist000000000000000002', 'Skippy'), track('new1', 'New Band')];
    const selection = selectTracks(asSuggestions(songs), songs, noneKnown, 'mixed', noVotes, [], history);

    expect(selection.tracks.map((item) => [item.track.id, item.known])).toEqual([
      ['Hist000000000000000001', true],
      ['new1', false],
    ]);

    expect(reasons(selection)).toEqual([['Song Hist000000000000000002', 'skipped']]);
  });

  it('on Discover, drops artists from the history by name and keeps one song per artist', () => {
    const songs = [track('a1', 'OLD BAND', 'other-id'), track('n1', 'New Band'), track('n2', 'New Band'), track('m1', 'Another')];
    const selection = selectTracks(asSuggestions(songs), songs, noneKnown, 'adventurous', noVotes, [], history);

    expect(selection.tracks.map((item) => item.track.id)).toEqual(['n1', 'm1']);

    expect(reasons(selection)).toEqual([
      ['Song a1', 'known_artist'],
      ['Song n2', 'same_artist'],
    ]);
  });
});
