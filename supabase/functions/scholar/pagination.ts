// Pure paging rules for the SerpAPI google_scholar_author fetch. Import-free so
// vitest can cover them; every extra page is a paid SerpAPI call.

/** SerpAPI's maximum page size for google_scholar_author articles. */
export const SERP_PAGE_SIZE = 100;
/** Safety cap: 10 pages = 1000 articles. */
export const SERP_MAX_PAGES = 10;

interface SerpAuthorPage {
  articles?: unknown[];
  serpapi_pagination?: { next?: string };
}

/**
 * Whether another page can hold more articles. A page shorter than the page
 * size is the last one, and so is a page with no `serpapi_pagination.next`
 * link. The old loop's guard compared a count with itself and never fired, so
 * every author with fewer than 100 articles paid for a second, empty call.
 */
export function hasMoreArticles(page: SerpAuthorPage): boolean {
  const count = page.articles?.length ?? 0;
  if (count < SERP_PAGE_SIZE) return false;
  // Older responses may lack the pagination block; fall back to the count rule.
  if (page.serpapi_pagination && !page.serpapi_pagination.next) return false;
  return true;
}

/**
 * Whether a cached profile must be refetched because its publication list may
 * be cut short. Entries whose paging ran to the end record
 * `_publicationsComplete: true`; anything else (legacy rows, a page that failed
 * mid-way) keeps the old heuristic that exactly 100 publications means the
 * pre-pagination fetch truncated them. Without the flag, a researcher with
 * exactly 100 publications missed the cache, and paid for a refetch, on every view.
 */
export function isLikelyTruncated(cached: { publications?: unknown[]; _publicationsComplete?: boolean }): boolean {
  if (cached._publicationsComplete === true) return false;
  return (cached.publications?.length ?? 0) === SERP_PAGE_SIZE;
}
