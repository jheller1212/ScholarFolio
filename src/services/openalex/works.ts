import { oaFetchJson, OA_API_URL, OA_EMAIL } from './author-lookup';

/**
 * A single OpenAlex work carrying the union of fields needed by BOTH the Open
 * Access enrichment and the field-normalized metrics, so one fetch serves both.
 */
export interface OaEnrichmentWork {
  title?: string;
  doi?: string;
  publication_year?: number;
  cited_by_count?: number;
  cited_by_percentile_year?: { min?: number; max?: number };
  open_access?: { oa_status?: string; oa_url?: string };
  best_oa_location?: {
    version?: string;
    is_oa?: boolean;
    source?: { display_name?: string };
  };
  primary_location?: {
    source?: {
      display_name?: string;
      summary_stats?: { '2yr_mean_citedness'?: number };
    };
  };
}

const SELECT =
  'title,open_access,best_oa_location,publication_year,doi,cited_by_count,cited_by_percentile_year,primary_location';

const PER_PAGE = 200;
const MAX_PAGES = 10;

interface WorksPage {
  meta?: { count?: number };
  results?: OaEnrichmentWork[];
}

// Memoize the in-flight/resolved works fetch per author so the OA-stats and
// field-normalized metric calls — which run concurrently on profile load —
// share ONE network fetch instead of each paginating the same works. Keyed by
// short author id (e.g. "A5077827457").
const worksCache = new Map<string, Promise<OaEnrichmentWork[]>>();

/**
 * Fetch all of an author's works (paginated, up to 2000) with the fields both
 * enrichment consumers need. Concurrent callers share one fetch. A failed,
 * partial, or empty result is NOT cached, so a later call can retry.
 *
 * Page 1 is fetched first to learn the total from `meta.count`; the remaining
 * pages are then fetched in PARALLEL, so a many-works author costs two
 * round-trip "hops" through the proxy instead of up to ten sequential ones.
 */
export function fetchAuthorEnrichmentWorks(shortId: string): Promise<OaEnrichmentWork[]> {
  const cached = worksCache.get(shortId);
  if (cached) return cached;

  // Marks a result we should NOT keep cached (a page failed → data has holes).
  let incomplete = false;

  const pageUrl = (page: number) =>
    `${OA_API_URL}/works?filter=authorships.author.id:${shortId}&per_page=${PER_PAGE}&page=${page}&select=${SELECT}&mailto=${OA_EMAIL}`;

  const promise = (async () => {
    const first = await oaFetchJson<WorksPage>(pageUrl(1));
    if (!first) incomplete = true;
    const all: OaEnrichmentWork[] = [...(first?.results ?? [])];
    if (all.length < PER_PAGE) return all;

    if (first?.meta?.count != null) {
      // Total known → fetch every remaining page concurrently.
      const totalPages = Math.min(Math.ceil(first.meta.count / PER_PAGE), MAX_PAGES);
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => oaFetchJson<WorksPage>(pageUrl(i + 2)))
      );
      for (const data of rest) {
        if (!data?.results) { incomplete = true; continue; }
        all.push(...data.results);
      }
      // An empty-but-non-null page (e.g. a stale proxy cache entry) leaves the
      // same hole as a failed one but passes the check above. Compare against
      // meta.count so a short total also blocks caching and allows a retry.
      const expected = Math.min(first.meta.count, MAX_PAGES * PER_PAGE);
      if (all.length < expected) incomplete = true;
    } else {
      // meta missing (shouldn't happen) → fall back to sequential paging.
      for (let page = 2; page <= MAX_PAGES; page++) {
        const data = await oaFetchJson<WorksPage>(pageUrl(page));
        if (!data?.results?.length) {
          if (!data) incomplete = true;
          break;
        }
        all.push(...data.results);
        if (data.results.length < PER_PAGE) break;
      }
    }
    return all;
  })();

  worksCache.set(shortId, promise);
  // Don't let a failed/partial/empty fetch poison the session cache — allow a
  // retry, while concurrent callers still share this in-flight promise.
  promise.then(
    (works) => { if (works.length === 0 || incomplete) worksCache.delete(shortId); },
    () => { worksCache.delete(shortId); }
  );
  return promise;
}
