import { findOpenAlexAuthor, oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';
import { logCaughtError } from '../../lib/errorLogger';
import type { FieldNormalizedMetrics } from '../../types/scholar';

export type { FieldNormalizedMetrics };

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

/**
 * Fetches field-normalized metrics for an author from OpenAlex:
 * - FWCI-like: average citation percentile across papers
 * - Mean journal citedness (proxy for mean IF)
 */
export async function fetchFieldNormalizedMetrics(
  authorName: string,
  authorAffiliation: string
): Promise<FieldNormalizedMetrics | null> {
  try {
    const author = await findOpenAlexAuthor(authorName, authorAffiliation);
    if (!author) return null;

    const shortId = author.id.replace('https://openalex.org/', '');

    // Fetch works with citation percentiles and source stats
    const allWorks: OpenAlexWork[] = [];
    let page = 1;
    while (page <= 5) {
      const data = await oaFetchJson<{ results: OpenAlexWork[] }>(
        `${OA_API_URL}/works?filter=authorships.author.id:${shortId}&per_page=200&page=${page}&select=doi,cited_by_count,cited_by_percentile_year,primary_location&mailto=${OA_EMAIL}`
      );
      if (!data?.results?.length) break;
      allWorks.push(...data.results);
      if (data.results.length < 200) break;
      page++;
    }

    if (allWorks.length === 0) return null;

    // FWCI-like metric (average citation percentile / 50)
    // 50th percentile = 1.0 (world average), >1.0 = above average
    const percentiles: number[] = [];
    for (const work of allWorks) {
      const pct = work.cited_by_percentile_year?.min;
      if (pct != null) percentiles.push(pct);
    }
    const fwci = percentiles.length > 0
      ? Number((percentiles.reduce((a, b) => a + b, 0) / percentiles.length / 50).toFixed(2))
      : null;

    // Mean journal citedness (proxy for mean IF)
    const citednessValues: number[] = [];
    for (const work of allWorks) {
      const citedness = work.primary_location?.source?.summary_stats?.['2yr_mean_citedness'];
      if (citedness != null && citedness > 0) citednessValues.push(citedness);
    }
    const meanCitedness = citednessValues.length > 0
      ? Number((citednessValues.reduce((a, b) => a + b, 0) / citednessValues.length).toFixed(2))
      : null;

    return {
      fwci,
      meanCitedness,
      paperCount: allWorks.length,
      rcrMean: null,
      rcrPaperCount: 0,
    };
  } catch (error) {
    logCaughtError(error, 'openalex', 'field-metrics', 'fetch-field-normalized');
    return null;
  }
}
