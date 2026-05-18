import { timeoutSignal } from '../../utils/api';
import { RateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';
const HEADERS = { 'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})` };

const metricsRateLimiter = new RateLimiter(5000, 10);

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    await metricsRateLimiter.acquireToken();
    const response = await fetch(url, { headers: HEADERS, signal: timeoutSignal(15000) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export interface FieldNormalizedMetrics {
  fwci: number | null;
  meanCitedness: number | null;
  paperCount: number;
  rcrMean: number | null;
  rcrPaperCount: number;
}

interface OpenAlexWork {
  doi?: string;
  cited_by_count?: number;
  cited_by_percentile_year?: { min?: number; max?: number };
  primary_location?: {
    source?: {
      display_name?: string;
      summary_stats?: { '2yr_mean_citedness'?: number };
    };
  };
}

interface ICiteResult {
  relative_citation_ratio?: number;
}

/**
 * Fetches field-normalized metrics for an author from OpenAlex:
 * - FWCI-like: average citation percentile across papers
 * - Mean journal citedness (proxy for mean IF)
 * Then enriches with RCR from NIH iCite for papers with DOIs.
 */
export async function fetchFieldNormalizedMetrics(
  authorName: string,
  authorAffiliation: string
): Promise<FieldNormalizedMetrics | null> {
  try {
    // Step 1: Find author in OpenAlex
    const authorSearch = await fetchJson<{ results: Array<{ id: string }> }>(
      `${API_URL}/authors?search=${encodeURIComponent(authorName)}&per_page=5&select=id,last_known_institutions,affiliations&mailto=${EMAIL}`
    );
    if (!authorSearch?.results?.length) return null;

    // Try to match by affiliation
    let authorId = authorSearch.results[0].id;
    if (authorSearch.results.length > 1 && authorAffiliation) {
      const affLower = authorAffiliation.toLowerCase();
      for (const result of authorSearch.results) {
        const fullResult = await fetchJson<{
          id: string;
          last_known_institutions?: Array<{ display_name?: string }>;
        }>(`${API_URL}/authors/${result.id.replace('https://openalex.org/', '')}?select=id,last_known_institutions&mailto=${EMAIL}`);
        const inst = fullResult?.last_known_institutions?.[0]?.display_name?.toLowerCase() || '';
        if (inst && affLower.includes(inst)) {
          authorId = result.id;
          break;
        }
      }
    }

    const shortId = authorId.replace('https://openalex.org/', '');

    // Step 2: Fetch works with citation percentiles and source stats
    const allWorks: OpenAlexWork[] = [];
    let page = 1;
    while (page <= 5) {
      const data = await fetchJson<{ results: OpenAlexWork[] }>(
        `${API_URL}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=doi,cited_by_count,cited_by_percentile_year,primary_location&mailto=${EMAIL}`
      );
      if (!data?.results?.length) break;
      allWorks.push(...data.results);
      if (data.results.length < 200) break;
      page++;
    }

    if (allWorks.length === 0) return null;

    // Step 3: Calculate FWCI-like metric (average citation percentile)
    const percentiles: number[] = [];
    for (const work of allWorks) {
      const pct = work.cited_by_percentile_year?.min;
      if (pct != null) percentiles.push(pct);
    }
    const fwci = percentiles.length > 0
      ? Number((percentiles.reduce((a, b) => a + b, 0) / percentiles.length / 50).toFixed(2))
      : null;
    // Dividing by 50 normalizes: 50th percentile = 1.0 (world average), >1.0 = above average

    // Step 4: Calculate mean journal citedness (proxy for mean IF)
    const citednessValues: number[] = [];
    for (const work of allWorks) {
      const citedness = work.primary_location?.source?.summary_stats?.['2yr_mean_citedness'];
      if (citedness != null && citedness > 0) citednessValues.push(citedness);
    }
    const meanCitedness = citednessValues.length > 0
      ? Number((citednessValues.reduce((a, b) => a + b, 0) / citednessValues.length).toFixed(2))
      : null;

    // Step 5: Fetch RCR from NIH iCite for papers with DOIs
    const dois = allWorks
      .map(w => w.doi?.replace('https://doi.org/', ''))
      .filter((d): d is string => !!d);

    let rcrMean: number | null = null;
    let rcrPaperCount = 0;

    if (dois.length > 0) {
      // iCite accepts up to 200 DOIs per request
      const rcrValues: number[] = [];
      const batchSize = 200;
      for (let i = 0; i < dois.length && i < 400; i += batchSize) {
        const batch = dois.slice(i, i + batchSize);
        try {
          const response = await fetch(
            `https://icite.od.nih.gov/api/pubs?dois=${batch.join(',')}`,
            { signal: timeoutSignal(15000) }
          );
          if (response.ok) {
            const data = await response.json();
            const pubs = data.data || data;
            if (Array.isArray(pubs)) {
              for (const pub of pubs as ICiteResult[]) {
                if (pub.relative_citation_ratio != null && pub.relative_citation_ratio > 0) {
                  rcrValues.push(pub.relative_citation_ratio);
                }
              }
            }
          }
        } catch {
          // iCite is optional — skip on error
        }
      }
      if (rcrValues.length > 0) {
        rcrMean = Number((rcrValues.reduce((a, b) => a + b, 0) / rcrValues.length).toFixed(2));
        rcrPaperCount = rcrValues.length;
      }
    }

    return {
      fwci,
      meanCitedness,
      paperCount: allWorks.length,
      rcrMean,
      rcrPaperCount,
    };
  } catch (error) {
    console.warn('[OpenAlex] Error fetching field-normalized metrics:', error);
    return null;
  }
}
