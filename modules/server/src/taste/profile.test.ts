import { describe, expect, it } from 'vitest';
import type { ArtistInfo, RawTaste, TrackInfo } from './collect.ts';
import { buildProfile, knownSets, rankArtists, representativeTracks } from './profile.ts';

const artist = (id: string): ArtistInfo => ({ id, name: id.toUpperCase(), genres: [], imageUrl: null });

const track = (id: string, artistId = 'a', isrc: string | null = null): TrackInfo => ({
  id,
  uri: `spotify:track:${id}`,
  name: `Song ${id}`,
  artists: [{ id: artistId, name: artistId.toUpperCase() }],
  album: 'Album',
  imageUrl: null,
  isrc,
});

const raw = (overrides: Partial<RawTaste> = {}): RawTaste => ({
  topArtists: { short_term: [], medium_term: [], long_term: [] },
  topTracks: { short_term: [], medium_term: [], long_term: [] },
  recent: [],
  saved: [],
  savedTotal: 0,
  followed: [],
  ...overrides,
});

describe('rankArtists', () => {
  it('tags rising, steady and older artists and puts all-round favourites first', () => {
    const ranked = rankArtists({
      short_term: [artist('new'), artist('core')],
      medium_term: [artist('core'), artist('mid')],
      long_term: [artist('core'), artist('old'), artist('mid')],
    });

    expect(ranked.map((a) => [a.id, a.trend])).toEqual([
      ['core', 'steady'],
      ['mid', 'steady'],
      ['new', 'rising'],
      ['old', 'older'],
    ]);

    expect(ranked[0]?.ranks).toEqual({ short_term: 2, medium_term: 1, long_term: 1 });
  });
});

describe('representativeTracks', () => {
  it('takes turns between the lists and skips repeats', () => {
    const picked = representativeTracks(
      { short_term: [track('s1'), track('x')], medium_term: [track('x'), track('m2')], long_term: [track('l1')] },
      4,
    );

    expect(picked.map((t) => t.id)).toEqual(['s1', 'x', 'l1', 'm2']);
  });
});

describe('knownSets', () => {
  it('collects tracks, ISRCs and artists from every source', () => {
    const known = knownSets(
      raw({
        topTracks: { short_term: [track('t1', 'a1', 'ISRC1')], medium_term: [], long_term: [] },
        recent: [{ track: track('t2', 'a2'), playedAt: '2026-11-05T10:00:00Z' }],
        saved: [track('t1', 'a1', 'ISRC1'), track('t3', 'a3', 'ISRC3')],
        followed: [artist('f1')],
      }),
    );

    expect(known.trackUris).toEqual(['spotify:track:t1', 'spotify:track:t2', 'spotify:track:t3']);
    expect(known.isrcs).toEqual(['ISRC1', 'ISRC3']);
    expect(known.artistIds.sort()).toEqual(['a1', 'a2', 'a3', 'f1']);
  });
});

describe('buildProfile', () => {
  it('writes the text Claude reads', () => {
    const profile = buildProfile(
      raw({
        topArtists: { short_term: [artist('core')], medium_term: [artist('core')], long_term: [artist('core')] },
        topTracks: { short_term: [track('t1', 'core')], medium_term: [], long_term: [] },
        recent: [{ track: track('t1', 'core'), playedAt: '2026-11-05T10:00:00Z' }],
        savedTotal: 1234,
      }),
    );

    expect(profile.promptText).toContain('1. CORE — steady (#1 / #1 / #1)');
    expect(profile.promptText).toContain('- CORE — Song t1');
    expect(profile.promptText).toContain('CORE ×1');
    expect(profile.promptText).toContain('1234 saved tracks');
    expect(profile.promptText).not.toContain('GENRES');
  });
});
