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
 * left uncached so a later profile load can retry. `complete` is false when
 * any batch failed — callers should then withhold the metric rather than
 * compute a silently skewed mean.
 */
async function resolveSourceCitedness(sourceIds: string[]): Promise<{
  citedness: ReadonlyMap<string, number | null>;
  complete: boolean;
}> {
  const missing = sourceIds.filter(id => !sourceCitednessCache.has(id));
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));

  let complete = true;
  await Promise.all(chunks.map(async chunk => {
    const data = await oaFetchJson<{ results?: Array<{
      id?: string;
      summary_stats?: { '2yr_mean_citedness'?: number };
    }> }>(
      `${OA_API_URL}/sources?filter=ids.openalex:${chunk.join('|')}&select=id,summary_stats&per_page=${chunk.length}&mailto=${OA_EMAIL}`
    );
    if (!data) {
      // Fetch failed — leave uncached so it can retry later.
      complete = false;
      return;
    }
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

  return { citedness: sourceCitednessCache, complete };
}

/**
 * Fetches field-normalized metrics for an author from OpenAlex:
 * - FWCI: median (+ mean) of OpenAlex's native per-work FWCI
 * - Top-decile share: % of works in the top 10% most-cited of their field
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

    // Native OpenAlex FWCI (normalized by subfield × year × publication type;
    // 1.0 = world average in that field). Median as the headline value — a
    // single viral paper can drag the mean far above what's typical — with the
    // mean kept as context for the narrative.
    const fwciValues = allWorks
      .map(w => w.fwci)
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b);
    let fwci: number | null = null;
    let fwciMean: number | null = null;
    if (fwciValues.length > 0) {
      const mid = Math.floor(fwciValues.length / 2);
      const median = fwciValues.length % 2 === 1
        ? fwciValues[mid]
        : (fwciValues[mid - 1] + fwciValues[mid]) / 2;
      fwci = Number(median.toFixed(2));
      fwciMean = Number((fwciValues.reduce((a, b) => a + b, 0) / fwciValues.length).toFixed(2));
    }

    // Share of works in the top 10% most-cited of their field/year/type —
    // the Leiden Ranking's PP(top 10%), robust to single-hit outliers.
    const classified = allWorks.filter(w => w.citation_normalized_percentile != null);
    const topDecileShare = classified.length > 0
      ? Math.round(
          (classified.filter(w => w.citation_normalized_percentile?.is_in_top_10_percent).length /
            classified.length) * 100
        )
      : null;

    // Mean journal citedness (proxy for mean IF). The embedded work source is
    // dehydrated (no summary_stats), so resolve stats for the distinct journals
    // via batched /sources lookups, then average PER WORK so journals the
    // author publishes in more often weigh more.
    const workSourceIds = allWorks.map(w =>
      w.primary_location?.source?.id?.replace('https://openalex.org/', '')
    );
    const distinctSourceIds = [...new Set(workSourceIds.filter((id): id is string => !!id))];
    const { citedness: citednessBySource, complete } = distinctSourceIds.length > 0
      ? await resolveSourceCitedness(distinctSourceIds)
      : { citedness: new Map<string, number | null>(), complete: true };

    const citednessValues: number[] = [];
    for (const sourceId of workSourceIds) {
      if (!sourceId) continue;
      const citedness = citednessBySource.get(sourceId);
      if (citedness != null && citedness > 0) citednessValues.push(citedness);
    }
    // A failed batch would skew the mean systematically (a dropped chunk is a
    // contiguous slice of the journal list) — withhold the metric instead; the
    // UI hides the card on null.
    const meanCitedness = complete && citednessValues.length > 0
      ? Number((citednessValues.reduce((a, b) => a + b, 0) / citednessValues.length).toFixed(2))
      : null;

    return {
      fwci,
      fwciMean,
      topDecileShare,
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
