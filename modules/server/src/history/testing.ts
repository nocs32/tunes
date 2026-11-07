import type { HistoryTrack } from './store.ts';

// Test-only: history songs. `months` is {"2026-03": plays}; totals and dates follow from it.
export const historyTrack = (n: number, artist: string, months: Record<string, number>, extra: Partial<HistoryTrack> = {}): HistoryTrack => {
  const keys = Object.keys(months).sort();
  const at = (key: string | undefined): number | null => (key ? Date.parse(`${key}-15T12:00:00Z`) : null);

  return {
    uri: `spotify:track:Hist${String(n).padStart(18, '0')}`,
    artist,
    title: `Song ${n}`,
    plays: Object.values(months).reduce((sum, count) => sum + count, 0),
    skips: 0,
    finishes: 1,
    firstAt: at(keys[0]),
    lastAt: at(keys.at(-1)),
    months,
    ...extra,
  };
};

// "Now" in these tests: 2026-11-07.
export const now = Date.parse('2026-11-07T12:00:00Z');
