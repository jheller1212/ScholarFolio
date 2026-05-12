/**
 * OpenAlex-based profile pipeline — free alternative to SerpAPI/Google Scholar.
 *
 * Returns the same Author type as the SerpAPI pipeline so it can be
 * swapped in without changing any downstream components.
 *
 * NOT LIVE YET — built as a standalone module for testing/evaluation.
 *
 * Known limitations vs. SerpAPI/Google Scholar:
 * - No profile photos (OpenAlex has no images)
 * - Citation counts may differ (OpenAlex uses Crossref/PubMed, GS crawls the web)
 * - Author disambiguation is imperfect — OpenAlex may merge works from
 *   different people with the same name into one profile (e.g. Jonas Heller
 *   the marketing researcher and Jonas Heller the engineer)
 * - Google Scholar profiles are self-curated; OpenAlex profiles are algorithmic
 * - Topics are OpenAlex's ML-classified topics, not the author's self-selected interests
 */

import type { Author, Publication, Topic } from '../../types/scholar';
import { findJournalRanking } from '../../data/journalRankings';
import { metricsCalculator } from '../metrics';
import { normalizeAuthorNames } from '../../utils/names';
import { RateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';
const HEADERS = { 'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})` };

// Dedicated rate limiter — OpenAlex polite pool: ~10 req/sec with mailto
const oaLimiter = new RateLimiter(5000, 10);

// ─── Internal types ──────────────────────────────────────────────────

interface OAAuthor {
  id: string;
  display_name: string;
  orcid?: string;
  works_count: number;
  cited_by_count: number;
  summary_stats: {
    h_index: number;
    i10_index: number;
    '2yr_mean_citedness': number;
  };
  last_known_institutions?: Array<{
    display_name: string;
    country_code: string;
  }>;
  topics?: Array<{
    display_name: string;
    id: string;
  }>;
  counts_by_year: Array<{
    year: number;
    works_count: number;
    cited_by_count: number;
  }>;
}

interface OAWork {
  title: string;
  publication_year: number;
  cited_by_count: number;
  doi?: string;
  id: string;
  authorships: Array<{
    author: { display_name: string };
  }>;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    landing_page_url?: string;
  };
}

interface OASearchResult {
  name: string;
  affiliation: string;
  authorId: string;
  citedBy: number;
  interests: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    await oaLimiter.acquireToken();
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Search for authors by name. Returns up to 10 results.
 * Replaces SerpAPI's google_scholar_profiles engine.
 */
export async function searchAuthorsOpenAlex(
  query: string
): Promise<OASearchResult[]> {
  const data = await fetchJson<{ results: OAAuthor[] }>(
    `${API_URL}/authors?search=${encodeURIComponent(query)}&per_page=10&select=id,display_name,last_known_institutions,cited_by_count,topics,summary_stats&mailto=${EMAIL}`
  );
  if (!data?.results) return [];

  return data.results.map((a) => ({
    name: a.display_name,
    affiliation:
      a.last_known_institutions?.[0]?.display_name ?? '',
    authorId: a.id.replace('https://openalex.org/', ''),
    citedBy: a.cited_by_count,
    interests: (a.topics ?? []).slice(0, 5).map((t) => t.display_name),
  }));
}

/**
 * Fetch a full researcher profile from OpenAlex.
 * Returns the same Author shape that the SerpAPI pipeline produces.
 *
 * @param authorId  OpenAlex author ID (e.g. "A5077827457")
 */
export async function fetchProfileOpenAlex(
  authorId: string
): Promise<Author | null> {
  // ── Step 1: Fetch author metadata ──────────────────────────────────
  const author = await fetchJson<OAAuthor>(
    `${API_URL}/authors/${authorId}?select=id,display_name,orcid,works_count,cited_by_count,summary_stats,last_known_institutions,topics,counts_by_year&mailto=${EMAIL}`
  );
  if (!author) return null;

  // ── Step 2: Fetch all works (paginated, up to 1000) ────────────────
  const publications: Publication[] = [];
  let page = 1;
  const maxPages = 5; // 200 per page × 5 = 1000 max

  while (page <= maxPages) {
    const worksData = await fetchJson<{ results: OAWork[] }>(
      `${API_URL}/works?filter=authorships.author.id:${authorId}&sort=publication_year:desc&per_page=200&page=${page}&select=title,authorships,primary_location,publication_year,cited_by_count,doi,id&mailto=${EMAIL}`
    );
    if (!worksData?.results?.length) break;

    for (const work of worksData.results) {
      // Skip works with no title
      if (!work.title) continue;

      const authors = work.authorships.map((a) => a.author.display_name);
      const venue =
        work.primary_location?.source?.display_name ?? '';
      const url = work.doi
        ? work.doi.startsWith('https://') ? work.doi : `https://doi.org/${work.doi}`
        : work.primary_location?.landing_page_url
          ?? `https://openalex.org/${work.id.replace('https://openalex.org/', '')}`;

      publications.push({
        title: work.title,
        authors,
        venue,
        year: work.publication_year ?? 0,
        citations: work.cited_by_count ?? 0,
        url,
        journalRanking: findJournalRanking(venue),
      });
    }

    if (worksData.results.length < 200) break;
    page++;
  }

  // Filter out works with no year AND 0 citations (same as SerpAPI pipeline)
  const filteredPubs = publications.filter(
    (p) => p.year > 0 || p.citations > 0
  );

  // Merge near-duplicate author names
  normalizeAuthorNames(filteredPubs);

  // ── Step 3: Build citations-per-year from counts_by_year ───────────
  const citationsPerYear: Record<string, number> = {};
  for (const entry of author.counts_by_year) {
    if (entry.cited_by_count > 0) {
      citationsPerYear[String(entry.year)] = entry.cited_by_count;
    }
  }

  // ── Step 4: Build topics ───────────────────────────────────────────
  const topics: Topic[] = (author.topics ?? []).slice(0, 10).map((t) => ({
    name: t.display_name,
    url: `https://openalex.org/${t.id.replace('https://openalex.org/', '')}`,
    paperCount: 0,
  }));

  // ── Step 5: Compute metrics (same calculator as SerpAPI pipeline) ──
  const metrics = metricsCalculator.calculateMetrics(
    filteredPubs,
    citationsPerYear,
    author.display_name
  );
  // Mark the citation graph source
  metrics.citationGraphSource = 'cited_by_graph';

  // ── Step 6: Build the Author object ────────────────────────────────
  const affiliation =
    author.last_known_institutions?.[0]?.display_name ?? '';

  const totalCitations =
    filteredPubs.reduce((sum, p) => sum + p.citations, 0);

  return {
    name: author.display_name,
    affiliation,
    imageUrl: undefined, // OpenAlex has no profile photos
    topics,
    hIndex: author.summary_stats.h_index,
    totalCitations,
    publications: filteredPubs,
    metrics,
    openAccess: undefined, // Filled async by existing OpenAlex OA enrichment
    cacheStatus: undefined,
  };
}
