import { describe, it, expect } from 'vitest';
import { CHANGELOG, formatReleaseDate, sortReleases } from '../changelog';

describe('formatReleaseDate', () => {
  it('renders an absolute, timezone-independent date', () => {
    expect(formatReleaseDate('2026-09-30')).toBe('Sep 30, 2026');
    expect(formatReleaseDate('2026-03-07')).toBe('Mar 7, 2026');
  });
});

describe('changelog data', () => {
  it('uses valid ISO days, one release per day', () => {
    const dates = CHANGELOG.map(r => r.date);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('sorts newest first regardless of authoring order', () => {
    const shuffled = [CHANGELOG[2], CHANGELOG[0], CHANGELOG[1]];
    expect(sortReleases(shuffled).map(r => r.date)).toEqual([CHANGELOG[0], CHANGELOG[1], CHANGELOG[2]].map(r => r.date).sort().reverse());
  });
});
