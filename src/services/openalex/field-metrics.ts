import { findOpenAlexAuthor, oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';
import { fetchAuthorEnrichmentWorks } from './works';
import { logCaughtError } from '../../lib/errorLogger';
import type { FieldNormalizedMetrics } from '../../types/scholar';

export type { FieldNormalizedMetrics };

// Session cache: source short id (e.g. "S137773608") → 2yr_mean_citedness
// (null = source resolved but has no stats). The dehydrated source embedded in
// works results does NOT carry summary_stats, so journal citedness needs this
// separate /sources lookup.
const sourceCitednessCache = new Map<string, number | null>();

/**
 * Resolve 2yr_mean_citedness for a set of source ids via batched /sources
 * calls (up to 100 ids per OR-filter). Cached per session; a failed batch is
 * left uncached so a later profile load can retry.
 */
async function resolveSourceCitedness(sourceIds: string[]): Promise<Map<string, number | null>> {
  const missing = sourceIds.filter(id => !sourceCitednessCache.has(id));
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));

  await Promise.all(chunks.map(async chunk => {
    const data = await oaFetchJson<{ results?: Array<{
      id?: string;
      summary_stats?: { '2yr_mean_citedness'?: number };
    }> }>(
      `${OA_API_URL}/sources?filter=ids.openalex:${chunk.join('|')}&select=id,summary_stats&per_page=${chunk.length}&mailto=${OA_EMAIL}`
    );
    if (!data) return; // fetch failed — leave uncached so it can retry later
    for (const s of data.results ?? []) {
      if (!s.id) continue;
      const shortId = s.id.replace('https://openalex.org/', '');
      sourceCitednessCache.set(shortId, s.summary_stats?.['2yr_mean_citedness'] ?? null);
    }
    // Ids the API didn't return: cache as null so we don't re-ask this session.
    for (const id of chunk) {
      if (!sourceCitednessCache.has(id)) sourceCitednessCache.set(id, null);
    }
  }));

  return sourceCitednessCache;
}

/**
 * Fetches field-normalized metrics for an author from OpenAlex:
 * - FWCI-like: average citation percentile across papers
 * - Mean journal citedness (proxy for mean IF)
 * Reuses the shared author works fetch (also consumed by the OA enrichment).
 */
export async function fetchFieldNormalizedMetrics(
  authorName: string,
  authorAffiliation: string
): Promise<FieldNormalizedMetrics | null> {
  try {
    const author = await findOpenAlexAuthor(authorName, authorAffiliation);
    if (!author) return null;

    const shortId = author.id.replace('https://openalex.org/', '');
    const allWorks = await fetchAuthorEnrichmentWorks(shortId);
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

    // Mean journal citedness (proxy for mean IF). The embedded work source is
    // dehydrated (no summary_stats), so resolve stats for the distinct journals
    // via batched /sources lookups, then average PER WORK so journals the
    // author publishes in more often weigh more.
    const workSourceIds = allWorks.map(w =>
      w.primary_location?.source?.id?.replace('https://openalex.org/', '')
    );
    const distinctSourceIds = [...new Set(workSourceIds.filter((id): id is string => !!id))];
    const citednessBySource = distinctSourceIds.length > 0
      ? await resolveSourceCitedness(distinctSourceIds)
      : new Map<string, number | null>();

    const citednessValues: number[] = [];
    for (const sourceId of workSourceIds) {
      if (!sourceId) continue;
      const citedness = citednessBySource.get(sourceId);
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
