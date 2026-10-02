import type { Author } from '../types/scholar';

export interface HeroMetric {
  label: string;
  value: string;
  hint: string;
}

/**
 * Google Scholar shows a "since <year>" column that is always five years back
 * from the current year; we mirror that window so our number matches what the
 * researcher sees on their own Scholar page.
 */
export function recentCitations(citationsPerYear: Record<string, number>, now = new Date()): { since: number; total: number } | null {
  const since = now.getFullYear() - 5;
  const entries = Object.entries(citationsPerYear);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [year, count]) => (Number(year) >= since ? sum + (count || 0) : sum), 0);
  return { since, total };
}

/** The four headline numbers shown at the top of every profile. */
export function heroMetrics(data: Author, now = new Date()): HeroMetric[] {
  const recent = recentCitations(data.metrics.citationsPerYear, now);
  const fourth: HeroMetric = recent
    ? { label: `Since ${recent.since}`, value: recent.total.toLocaleString(), hint: `Citations received since ${recent.since}` }
    : { label: 'Publications', value: data.publications.length.toLocaleString(), hint: 'Indexed publications' };
  return [
    { label: 'Citations', value: data.totalCitations.toLocaleString(), hint: 'Total citations' },
    { label: 'h-index', value: String(data.hIndex), hint: 'h papers with at least h citations each' },
    { label: 'i10-index', value: String(data.metrics.i10Index), hint: 'Papers with at least 10 citations' },
    fourth,
  ];
}
