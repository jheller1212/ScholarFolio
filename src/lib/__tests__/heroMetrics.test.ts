import { describe, it, expect } from 'vitest';
import { recentCitations } from '../heroMetrics';

describe('recentCitations', () => {
  const now = new Date('2026-10-02T12:00:00Z');

  it('sums the Google Scholar "since" window (current year minus five)', () => {
    const perYear = { '2019': 100, '2020': 50, '2021': 10, '2025': 5, '2026': 1 };
    expect(recentCitations(perYear, now)).toEqual({ since: 2021, total: 16 });
  });

  it('returns null without a citation graph', () => {
    expect(recentCitations({}, now)).toBeNull();
  });
});
