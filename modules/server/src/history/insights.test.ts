import { describe, expect, it } from 'vitest';
import { historyFilters, historyText, rediscoverCandidates } from './insights.ts';
import { historyTrack, now } from './testing.ts';

const tracks = [
  historyTrack(1, 'Lately Band', { '2026-10': 40 }),
  historyTrack(2, 'This Year', { '2026-02': 60 }),
  historyTrack(3, 'Last Year', { '2025-03': 90 }),
  historyTrack(4, 'Long Ago', { '2023-05': 30 }),
  historyTrack(5, 'Skipped', {}, { skips: 4, finishes: 0, plays: 0 }),
];

describe('what Claude reads from the history', () => {
  it('puts the last 12 months first, then older years as past phases', () => {
    const text = historyText(tracks, now) ?? '';

    expect(text).toContain('LAST 12 MONTHS, most-played artists: This Year ×60, Lately Band ×40');
    expect(text).toContain('LATELY (last 3 months): Lately Band ×40');
    expect(text).not.toMatch(/LAST 12 MONTHS.*Last Year/);
    expect(text).toContain('- 12/2024 to 11/2025: Last Year');
    expect(text).toContain('- 05/2023 to 11/2023: Long Ago');
    expect(text).toContain('Skipped — Song 5');
  });

  it('says nothing without an import', () => {
    expect(historyText([], now)).toBeNull();
  });
});

describe('history filters and old favourites', () => {
  it('knows songs and artists played, and the skipped ones', () => {
    const filters = historyFilters(tracks);

    expect(filters.trackUris.size).toBe(4);
    expect(filters.artistNames.has('last year')).toBe(true);
    expect(filters.artistNames.has('skipped')).toBe(false);
    expect([...filters.skippedIds]).toEqual(['Hist000000000000000005']);
  });

  it('offers songs with many plays and none in the last year, most played first', () => {
    const picks = rediscoverCandidates([...tracks, historyTrack(6, 'Few', { '2024-01': 2 })], () => true, now);

    expect(picks.map((track) => track.artist)).toEqual(['Last Year', 'Long Ago']);
  });
});
