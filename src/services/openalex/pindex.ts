/**
 * P-Index Calculator using OpenAlex data
 *
 * Implements the p-index from Pham, Wu & Wang (2024, JCR):
 * "The average citation percentile rank of a researcher's published articles
 *  relative to other articles published the same year by the same journals."
 *
 * Uses OpenAlex group_by=cited_by_count for efficient journal-year distributions
 * (1 API call per journal-year instead of paginating thousands of papers).
 *
 * Authorship weighting uses Abbas (2011, Scientometrics):
 *   w_j = 2(k - j + 1) / (k(k + 1))
 */

import { oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';

// --- Types ---

export interface PIndexWork {
  id: string;
  title: string;
  journal: string;
  journalId: string;
  year: number;
  citations: number;
  authorPosition: number;
  totalAuthors: number;
}

export interface PIndexResult {
  rawPIndex: number | null;
  owpiPIndex: number | null;
  weightedCitations: number;
  worksAnalyzed: number;
  worksWithPercentile: number;
  topPublications: Array<{
    title: string;
    journal: string;
    year: number;
    citations: number;
    percentileRank: number;
    authorPosition: number;
    totalAuthors: number;
  }>;
}

interface CitationDistribution {
  totalPapers: number;
  freq: Map<number, number>;
  maxCitationInGroups: number;
}

interface OAWork {
  id: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: Array<{
    author_position?: string;
    author?: { id?: string };
  }>;
  primary_location?: {
    source?: {
      id?: string;
      display_name?: string;
    };
  };
}

// --- Helpers ---

function abbasWeight(position: number, totalAuthors: number): number {
  const k = totalAuthors;
  const j = position;
  if (k <= 0 || k === 1) return 1;
  return (2 * (k - j + 1)) / (k * (k + 1));
}

function percentileFromDistribution(
  citationCount: number,
  dist: CitationDistribution
): number {
  let below = 0;
  let equal = 0;

  for (const [cit, count] of dist.freq) {
    if (cit < citationCount) below += count;
    else if (cit === citationCount) equal += count;
  }

  const coveredPapers = Array.from(dist.freq.values()).reduce((a, b) => a + b, 0);
  const uncovered = dist.totalPapers - coveredPapers;
  if (uncovered > 0 && citationCount > dist.maxCitationInGroups) {
    below += coveredPapers;
    equal = Math.max(1, uncovered);
  }

  return ((below + 0.5 * equal) / dist.totalPapers) * 100;
}

const distCache = new Map<string, CitationDistribution>();

async function fetchJournalYearDistribution(
  sourceId: string,
  year: number
): Promise<CitationDistribution | null> {
  const key = `${sourceId}__${year}`;
  if (distCache.has(key)) return distCache.get(key)!;

  const shortSourceId = sourceId.replace('https://openalex.org/', '');
  const data = await oaFetchJson<{
    meta: { count: number };
    group_by: Array<{ key: string; count: number }>;
  }>(
    `${OA_API_URL}/works?filter=primary_location.source.id:${shortSourceId},publication_year:${year}&group_by=cited_by_count&per_page=200&mailto=${OA_EMAIL}`
  );

  if (!data?.group_by?.length) return null;

  const freq = new Map<number, number>();
  let maxCit = 0;
  for (const g of data.group_by) {
    const cit = parseInt(g.key, 10);
    if (!isNaN(cit)) {
      freq.set(cit, g.count);
      if (cit > maxCit) maxCit = cit;
    }
  }

  const dist: CitationDistribution = {
    totalPapers: data.meta.count,
    freq,
    maxCitationInGroups: maxCit,
  };
  distCache.set(key, dist);
  return dist;
}

function findAuthorPosition(
  work: OAWork,
  targetAuthorId: string
): { position: number; total: number } {
  const authorships = work.authorships || [];
  const total = authorships.length || 1;
  for (let i = 0; i < authorships.length; i++) {
    if (authorships[i].author?.id === targetAuthorId) {
      return { position: i + 1, total };
    }
  }
  return { position: 1, total };
}

// --- Public API ---

/**
 * Fetch all publications for an OpenAlex author, returning a simplified list
 * the user can review and filter before computing the p-index.
 */
export async function fetchPIndexWorks(authorId: string): Promise<PIndexWork[]> {
  const shortId = authorId.replace('https://openalex.org/', '');
  const allWorks: OAWork[] = [];
  let page = 1;

  while (page <= 10) {
    const data = await oaFetchJson<{ results: OAWork[] }>(
      `${OA_API_URL}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=id,title,publication_year,cited_by_count,authorships,primary_location&mailto=${OA_EMAIL}`,
      30000
    );
    if (!data?.results?.length) break;
    allWorks.push(...data.results);
    if (data.results.length < 200) break;
    page++;
  }

  return allWorks.map(w => {
    const { position, total } = findAuthorPosition(w, authorId);
    return {
      id: w.id,
      title: w.title || 'Untitled',
      journal: w.primary_location?.source?.display_name || 'Unknown',
      journalId: w.primary_location?.source?.id || '',
      year: w.publication_year || 0,
      citations: w.cited_by_count ?? 0,
      authorPosition: position,
      totalAuthors: total,
    };
  });
}

/**
 * Compute the p-index from a pre-filtered list of works.
 * @param works The works to include (after user review)
 * @param authorId Full OpenAlex author ID (needed for journal-year lookups)
 * @param onProgress Optional callback with progress updates (0-100)
 */
export async function computePIndexFromWorks(
  works: PIndexWork[],
  authorId: string,
  onProgress?: (pct: number, status: string) => void
): Promise<PIndexResult | null> {
  if (works.length === 0) return null;

  // Collect unique journal-year combos
  const journalYears = new Set<string>();
  for (const w of works) {
    if (w.journalId && w.year) {
      journalYears.add(`${w.journalId}__${w.year}`);
    }
  }

  // Fetch distributions
  const total = journalYears.size;
  let fetched = 0;
  for (const jy of journalYears) {
    const [sourceId, yearStr] = jy.split('__');
    await fetchJournalYearDistribution(sourceId, Number(yearStr));
    fetched++;
    const pct = Math.round((fetched / total) * 90);
    if (fetched % 5 === 0 || fetched === total) {
      onProgress?.(pct, `Analyzing journals… ${fetched}/${total}`);
    }
  }

  // Compute percentile ranks
  const ranked: Array<{
    title: string;
    journal: string;
    year: number;
    citations: number;
    percentileRank: number;
    authorPosition: number;
    totalAuthors: number;
    weight: number;
  }> = [];

  for (const work of works) {
    if (!work.journalId || !work.year) continue;

    const key = `${work.journalId}__${work.year}`;
    const dist = distCache.get(key);
    if (!dist) continue;

    const pctRank = percentileFromDistribution(work.citations, dist);
    const weight = abbasWeight(work.authorPosition, work.totalAuthors);

    ranked.push({
      title: work.title,
      journal: work.journal,
      year: work.year,
      citations: work.citations,
      percentileRank: Number(pctRank.toFixed(2)),
      authorPosition: work.authorPosition,
      totalAuthors: work.totalAuthors,
      weight,
    });
  }

  if (ranked.length === 0) return null;

  const rawPIndex = Number(
    (ranked.reduce((s, p) => s + p.percentileRank, 0) / ranked.length).toFixed(2)
  );

  const totalWeight = ranked.reduce((s, p) => s + p.weight, 0);
  const owpiPIndex = Number(
    (ranked.reduce((s, p) => s + p.percentileRank * p.weight, 0) / totalWeight).toFixed(2)
  );

  // Authorship-weighted total citations: sum of (citations × Abbas weight) across all included works
  const weightedCitations = Math.round(
    works.reduce((sum, w) => {
      const weight = abbasWeight(w.authorPosition, w.totalAuthors);
      return sum + w.citations * weight;
    }, 0)
  );

  ranked.sort((a, b) => b.percentileRank - a.percentileRank);

  onProgress?.(100, 'Done');

  return {
    rawPIndex,
    owpiPIndex,
    weightedCitations,
    worksAnalyzed: works.length,
    worksWithPercentile: ranked.length,
    topPublications: ranked.slice(0, 10).map(({ weight: _, ...rest }) => rest),
  };
}
