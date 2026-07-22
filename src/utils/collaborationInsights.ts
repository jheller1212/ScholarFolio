import type { Publication } from '../types/scholar';
import { coAuthorsOf, inferMainAuthor, isSameResearcher } from './authorIdentity';

export interface CollaborationInsights {
  totalCoAuthors: number;
  soloPapers: number;
  collabPapers: number;
  soloPercent: number;
  avgAuthors: string;
  topByPapers: { name: string; papers: number; citations: number } | null;
  topByCitations: { name: string; papers: number; citations: number } | null;
  oneTimeCollaborators: number;
  oneTimeCitations: number;
  topOneTimer: { name: string; citations: number } | null;
}

/**
 * The "Collaboration Insights" figures shown on the Co-author Network tab.
 *
 * Pure and exported so the name-matching audit can assert on the same numbers
 * the tab renders — this panel is where a user found her own maiden name
 * ranked as her most frequent collaborator, and a check that runs against a
 * copy of the logic would not have caught it.
 */
export function computeCollaborationInsights(
  publications: Publication[],
  authorName?: string
): CollaborationInsights | null {
  if (!publications.length) return null;

  const mainAuth = authorName?.trim() || inferMainAuthor(publications);
  if (!mainAuth) return null;

  // Solo papers: every listed author is the owner under some spelling.
  const soloPapers = publications.filter(
    p => p.authors.length === 1 && isSameResearcher(p.authors[0], mainAuth)
  );
  const collabPapers = publications.filter(p => p.authors.length > 1);

  const coAuthors = new Map<string, { papers: number; citations: number; years: number[] }>();
  for (const pub of publications) {
    for (const a of coAuthorsOf(pub.authors, mainAuth)) {
      const existing = coAuthors.get(a) || { papers: 0, citations: 0, years: [] };
      existing.papers++;
      existing.citations += pub.citations;
      if (pub.year > 0) existing.years.push(pub.year);
      coAuthors.set(a, existing);
    }
  }

  const sorted = [...coAuthors.entries()].sort((a, b) => b[1].papers - a[1].papers);
  const topByPapers = sorted[0];
  const topByCitations = [...coAuthors.entries()].sort((a, b) => b[1].citations - a[1].citations)[0];

  const oneTimers = [...coAuthors.entries()]
    .filter(([, d]) => d.papers === 1)
    .sort((a, b) => b[1].citations - a[1].citations);
  const oneTimeCitations = oneTimers.reduce((sum, [, d]) => sum + d.citations, 0);

  const avgAuthors = publications.reduce((sum, p) => sum + p.authors.length, 0) / publications.length;

  return {
    totalCoAuthors: coAuthors.size,
    soloPapers: soloPapers.length,
    collabPapers: collabPapers.length,
    soloPercent: Math.round((soloPapers.length / publications.length) * 100),
    avgAuthors: avgAuthors.toFixed(1),
    topByPapers: topByPapers
      ? { name: topByPapers[0], papers: topByPapers[1].papers, citations: topByPapers[1].citations }
      : null,
    topByCitations: topByCitations
      ? { name: topByCitations[0], papers: topByCitations[1].papers, citations: topByCitations[1].citations }
      : null,
    oneTimeCollaborators: oneTimers.length,
    oneTimeCitations,
    topOneTimer: oneTimers[0]
      ? { name: oneTimers[0][0], citations: oneTimers[0][1].citations }
      : null,
  };
}

/**
 * Co-author nodes of the network graph: every distinct collaborator across the
 * publication list, owner variants and truncation markers removed.
 */
export function networkCoAuthorNodes(publications: Publication[], authorName?: string): string[] {
  const mainAuth = authorName?.trim() || inferMainAuthor(publications);
  if (!mainAuth) return [];
  const names = new Set<string>();
  for (const pub of publications) {
    for (const a of coAuthorsOf(pub.authors, mainAuth)) names.add(a);
  }
  return [...names];
}
