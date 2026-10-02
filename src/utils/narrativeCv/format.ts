// Pure text helpers for the narrative CV export. Kept free of `docx` so they
// can be unit-tested and reused without pulling the Word library in.

import type { Author, OpenAccessStats, Publication } from '../../types/scholar';

export function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

/** Same normalisation the OpenAlex service uses for its per-title maps. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isOA(pub: Publication, openAccess?: OpenAccessStats): boolean {
  if (!openAccess?.publicationOa) return false;
  const entry = openAccess.publicationOa[normalizeTitle(pub.title)];
  return !!entry && entry.status !== 'closed';
}

export function orcidDateRange(startYear: number | null, endYear: number | null): string {
  if (!startYear) return '';
  return endYear ? `${startYear}–${endYear}` : `${startYear}–present`;
}

export function topicNames(data: Author): string[] {
  return data.topics
    .map(t => (typeof t.name === 'object' ? (t.name as { title?: string }).title || '' : String(t.name)))
    .filter(Boolean);
}

export function selectKeyOutputs(publications: Publication[], limit = 10): Publication[] {
  return [...publications]
    .sort((a, b) => {
      const aFt = a.journalRanking?.ft50 ? 1 : 0;
      const bFt = b.journalRanking?.ft50 ? 1 : 0;
      if (aFt !== bFt) return bFt - aFt;
      const absOrder: Record<string, number> = { '4*': 5, '4': 4, '3': 3, '2': 2, '1': 1 };
      const aAbs = absOrder[a.journalRanking?.abs || ''] || 0;
      const bAbs = absOrder[b.journalRanking?.abs || ''] || 0;
      if (aAbs !== bAbs) return bAbs - aAbs;
      return b.citations - a.citations;
    })
    .slice(0, limit);
}
