/**
 * Semantic Scholar API service
 * Enriches publications with influential citation counts, TLDR summaries,
 * and recommendation data. All endpoints are free, no API key required.
 *
 * Rate limit: 100 requests per 5 minutes (unauthenticated)
 * Batch endpoint: up to 500 papers per request
 */

const S2_API = 'https://api.semanticscholar.org/graph/v1';
const BATCH_SIZE = 500;
const FIELDS = 'title,citationCount,influentialCitationCount,tldr,externalIds';

export interface S2PaperData {
  paperId: string;
  title: string;
  citationCount: number;
  influentialCitationCount: number;
  tldr?: {
    model: string;
    text: string;
  };
  externalIds?: {
    DOI?: string;
    MAG?: string;
    CorpusId?: number;
  };
}

export interface S2EnrichmentResult {
  /** Map from normalized title to S2 paper data */
  papers: Map<string, S2PaperData>;
  /** Aggregate stats across all matched papers */
  stats: {
    matched: number;
    total: number;
    totalInfluentialCitations: number;
    papersWithTldr: number;
  };
}

/** Normalize a title for matching between Google Scholar and Semantic Scholar */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search S2 for a paper by title and return the best match
 */
async function searchPaperByTitle(title: string): Promise<S2PaperData | null> {
  try {
    const res = await fetch(
      `${S2_API}/paper/search?query=${encodeURIComponent(title)}&limit=1&fields=${FIELDS}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data?.length) return null;
    return data.data[0];
  } catch {
    return null;
  }
}

/**
 * Batch fetch S2 data for papers with known DOIs
 */
async function batchFetchByDois(dois: string[]): Promise<(S2PaperData | null)[]> {
  if (dois.length === 0) return [];

  const results: (S2PaperData | null)[] = [];

  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    const batch = dois.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(
        `${S2_API}/paper/batch?fields=${FIELDS}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch.map(d => `DOI:${d}`) }),
        }
      );
      if (!res.ok) {
        results.push(...batch.map(() => null));
        continue;
      }
      const data: (S2PaperData | null)[] = await res.json();
      results.push(...data);
    } catch {
      results.push(...batch.map(() => null));
    }
  }

  return results;
}

/**
 * Enrich a list of publications with Semantic Scholar data.
 *
 * Strategy:
 * 1. First try to match via DOIs from OpenAlex (batch endpoint, fast)
 * 2. For unmatched papers, fall back to title search (slower, rate-limited)
 *
 * @param publications - Publications with titles (and optionally DOIs from OpenAlex)
 * @param doiMap - Optional map of normalized title → DOI (from OpenAlex)
 */
export async function enrichWithSemanticScholar(
  publications: Array<{ title: string }>,
  doiMap?: Map<string, string>
): Promise<S2EnrichmentResult> {
  const papers = new Map<string, S2PaperData>();
  const normalizedTitles = publications.map(p => normalizeTitle(p.title));

  // Phase 1: Batch fetch papers with DOIs
  const titlesToDois: Array<{ normalizedTitle: string; doi: string }> = [];
  const titlesWithoutDoi: string[] = [];

  for (const pub of publications) {
    const nt = normalizeTitle(pub.title);
    const doi = doiMap?.get(nt);
    if (doi) {
      titlesToDois.push({ normalizedTitle: nt, doi });
    } else {
      titlesWithoutDoi.push(nt);
    }
  }

  if (titlesToDois.length > 0) {
    const batchResults = await batchFetchByDois(titlesToDois.map(t => t.doi));
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      if (result) {
        papers.set(titlesToDois[i].normalizedTitle, result);
      }
    }
  }

  // Phase 2: Title search for unmatched papers (limit to avoid rate limits)
  const unmatchedTitles = normalizedTitles.filter(nt => !papers.has(nt));
  const titleSearchLimit = Math.min(unmatchedTitles.length, 10); // Cap at 10 title searches

  for (let i = 0; i < titleSearchLimit; i++) {
    const nt = unmatchedTitles[i];
    const originalTitle = publications.find(p => normalizeTitle(p.title) === nt)?.title;
    if (!originalTitle) continue;

    const result = await searchPaperByTitle(originalTitle);
    if (result) {
      // Verify the match is reasonable (title similarity)
      const resultNt = normalizeTitle(result.title);
      if (resultNt === nt || nt.includes(resultNt) || resultNt.includes(nt)) {
        papers.set(nt, result);
      }
    }

    // Small delay between title searches to respect rate limits
    if (i < titleSearchLimit - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Compute aggregate stats
  let totalInfluentialCitations = 0;
  let papersWithTldr = 0;

  papers.forEach(p => {
    totalInfluentialCitations += p.influentialCitationCount;
    if (p.tldr?.text) papersWithTldr++;
  });

  return {
    papers,
    stats: {
      matched: papers.size,
      total: publications.length,
      totalInfluentialCitations,
      papersWithTldr,
    },
  };
}
