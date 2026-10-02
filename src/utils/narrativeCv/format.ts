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

/**
 * Candidate key outputs: most cited first, newest first on ties. Deliberately
 * ignores journal rankings: NWO and other DORA-aligned funders do not accept
 * journal prestige as a quality signal, and the researcher replaces these anyway.
 */
export function selectKeyOutputs(publications: Publication[], limit = 10): Publication[] {
  return [...publications]
    .sort((a, b) => (b.citations - a.citations) || ((b.year || 0) - (a.year || 0)))
    .slice(0, limit);
}

/**
 * Author list for an output entry. NWO forbids "et al." so committees can see
 * the applicant's position; other formats may cap very long lists.
 */
export function formatAuthors(authors: string[], max = Infinity): string {
  const names = authors.map(a => a.trim()).filter(Boolean);
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} et al.`;
}

// Author-level metrics (h-index, citation totals) are not allowed in the NWO CV.
const METRIC_SENTENCE = /h-index|i10|citation|\bcited\b|impact factor/i;

/** Strip markdown and drop whole sentences that cite author-level metrics. */
export function dropMetricSentences(text: string): string {
  return stripMarkdown(text)
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !METRIC_SENTENCE.test(sentence))
    .join(' ')
    .trim();
}
