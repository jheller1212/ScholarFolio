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

export interface PIndexResult {
  rawPIndex: number | null;
  owpiPIndex: number | null;
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

/**
 * Abbas (2011) positional weight.
 * w_j = 2(k - j + 1) / (k(k + 1))
 */
function abbasWeight(position: number, totalAuthors: number): number {
  const k = totalAuthors;
  const j = position;
  if (k <= 0 || k === 1) return 1;
  return (2 * (k - j + 1)) / (k * (k + 1));
}

/**
 * Compute percentile rank from a frequency distribution.
 * (B + 0.5 * E) / N * 100
 */
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

// --- Core ---

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

/**
 * Compute the p-index for an OpenAlex author.
 * @param authorId Full OpenAlex author ID (e.g. "https://openalex.org/A5077827457")
 * @param onProgress Optional callback with progress updates (0-100)
 */
export async function computePIndex(
  authorId: string,
  onProgress?: (pct: number, status: string) => void
): Promise<PIndexResult | null> {
  const shortId = authorId.replace('https://openalex.org/', '');
  onProgress?.(5, 'Fetching publications…');

  // Fetch all works
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

  if (allWorks.length === 0) return null;
  onProgress?.(15, `Found ${allWorks.length} publications`);

  // Collect unique journal-year combos
  const journalYears = new Set<string>();
  for (const w of allWorks) {
    if (w.primary_location?.source?.id && w.publication_year) {
      journalYears.add(`${w.primary_location.source.id}__${w.publication_year}`);
    }
  }

  // Fetch distributions
  const total = journalYears.size;
  let fetched = 0;
  for (const jy of journalYears) {
    const [sourceId, yearStr] = jy.split('__');
    await fetchJournalYearDistribution(sourceId, Number(yearStr));
    fetched++;
    const pct = 15 + Math.round((fetched / total) * 75);
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

  for (const work of allWorks) {
    const sourceId = work.primary_location?.source?.id;
    const year = work.publication_year || 0;
    const citations = work.cited_by_count ?? 0;

    if (!sourceId || !year) continue;

    const key = `${sourceId}__${year}`;
    const dist = distCache.get(key);
    if (!dist) continue;

    const pctRank = percentileFromDistribution(citations, dist);
    const { position, total: totalAuthors } = findAuthorPosition(work, authorId);
    const weight = abbasWeight(position, totalAuthors);

    ranked.push({
      title: work.title || 'Untitled',
      journal: work.primary_location?.source?.display_name || 'Unknown',
      year,
      citations,
      percentileRank: Number(pctRank.toFixed(2)),
      authorPosition: position,
      totalAuthors,
      weight,
    });
  }

  if (ranked.length === 0) return null;

  // Raw p-index
  const rawPIndex = Number(
    (ranked.reduce((s, p) => s + p.percentileRank, 0) / ranked.length).toFixed(2)
  );

  // OWPI
  const totalWeight = ranked.reduce((s, p) => s + p.weight, 0);
  const owpiPIndex = Number(
    (ranked.reduce((s, p) => s + p.percentileRank * p.weight, 0) / totalWeight).toFixed(2)
  );

  // Top publications sorted by percentile
  ranked.sort((a, b) => b.percentileRank - a.percentileRank);

  onProgress?.(100, 'Done');

  return {
    rawPIndex,
    owpiPIndex,
    worksAnalyzed: allWorks.length,
    worksWithPercentile: ranked.length,
    topPublications: ranked.slice(0, 10).map(({ weight: _, ...rest }) => rest),
  };
}
