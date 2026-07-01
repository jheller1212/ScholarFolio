import { timeoutSignal } from '../../utils/api';
import { RateLimiter } from '../scholar/rate-limiter';
import { logCaughtError } from '../../lib/errorLogger';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'info@scholarfolio.org';
export const OA_EMAIL = EMAIL;
export const OA_API_URL = API_URL;

/** Shared rate limiter for all OpenAlex calls (polite pool allows ~100/sec) */
export const oaRateLimiter = new RateLimiter(5000, 100);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Strip the OpenAlex origin so only the path+query reaches our proxy. */
function toOaPath(url: string): string {
  return url.replace(/^https?:\/\/api\.openalex\.org/, '');
}

/**
 * Generic OpenAlex JSON fetcher. Routed through the `scholar` edge function,
 * which injects a server-side OpenAlex API key (mandatory since 2026-02-13) so
 * every visitor shares one authenticated, rate-stable pool rather than the
 * best-effort anonymous tier. Responses are cached server-side to conserve the
 * daily credit budget.
 */
export async function oaFetchJson<T>(url: string, timeoutMs = 15000): Promise<T | null> {
  try {
    await oaRateLimiter.acquireToken();
    const oaPath = toOaPath(url);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/scholar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'openalex', oaPath }),
      signal: timeoutSignal(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`[OpenAlex] proxy HTTP ${response.status} for ${toOaPath(url).split('?')[0]}`);
      return null;
    }
    return await response.json() as T;
  } catch (err) {
    console.warn('[OpenAlex] Fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface OpenAlexAuthor {
  id: string;
  displayName: string;
  orcid?: string;
  lastKnownInstitutions: Array<{
    id: string;
    display_name: string;
    country_code: string;
  }>;
}

// In-memory cache keyed by "name|affiliation", valid for the page session.
// Caches the Promise (not just the result) so concurrent callers — OA stats,
// field metrics, co-author geo — share ONE lookup instead of each searching.
const authorCache = new Map<string, Promise<OpenAlexAuthor | null>>();

/**
 * Single consolidated OpenAlex author lookup, shared per session so all services
 * (including concurrent callers) reuse one lookup. Successful results are cached;
 * null/failed results are dropped so a later call can retry rather than being
 * poisoned by a transient OpenAlex hiccup.
 */
export function findOpenAlexAuthor(
  name: string,
  affiliation: string
): Promise<OpenAlexAuthor | null> {
  const cacheKey = `${name.toLowerCase().trim()}|${affiliation.toLowerCase().trim()}`;
  const cached = authorCache.get(cacheKey);
  if (cached) return cached;
  const promise = resolveOpenAlexAuthor(name, affiliation);
  authorCache.set(cacheKey, promise);
  promise.then(
    (author) => { if (!author) authorCache.delete(cacheKey); },
    () => { authorCache.delete(cacheKey); }
  );
  return promise;
}

/**
 * Uncached author resolution:
 * 1. Searches by name (per_page=10)
 * 2. Filters by display_name match
 * 3. Refines by affiliation match
 * 4. Fetches ORCID from full author record
 */
async function resolveOpenAlexAuthor(
  name: string,
  affiliation: string
): Promise<OpenAlexAuthor | null> {
  try {
    const searchData = await oaFetchJson<{ results: Array<{
      id: string;
      display_name: string;
      orcid?: string;
      last_known_institutions?: Array<{
        id: string;
        display_name: string;
        country_code: string;
      }>;
      affiliations?: Array<{ institution?: { display_name?: string } }>;
    }> }>(
      `${API_URL}/authors?search=${encodeURIComponent(name)}&per_page=10&select=id,display_name,orcid,last_known_institutions,affiliations&mailto=${EMAIL}`
    );

    const results = searchData?.results;
    if (!results?.length) {
      return null;
    }

    // Filter to results whose display_name matches the search name
    const nameLower = name.toLowerCase().trim();
    const nameMatches = results.filter(r =>
      r.display_name.toLowerCase().trim() === nameLower
    );
    const candidates = nameMatches.length > 0 ? nameMatches : results;

    // Try affiliation match among candidates
    let best = candidates[0];
    if (candidates.length > 1 && affiliation) {
      const affLower = affiliation.toLowerCase();
      for (const candidate of candidates) {
        const lastInst = candidate.last_known_institutions?.[0]?.display_name?.toLowerCase() || '';
        const allInsts = (candidate.affiliations || []).map(
          (a: { institution?: { display_name?: string } }) => a.institution?.display_name?.toLowerCase() || ''
        );
        if ((lastInst && affLower.includes(lastInst)) ||
            allInsts.some((inst: string) => inst && affLower.includes(inst))) {
          best = candidate;
          break;
        }
      }
    }

    // Fetch ORCID from full author record if not in search result
    let orcid = best.orcid;
    if (!orcid) {
      const shortId = best.id.replace('https://openalex.org/', '');
      const fullAuthor = await oaFetchJson<{ orcid?: string }>(
        `${API_URL}/authors/${shortId}?select=orcid&mailto=${EMAIL}`
      );
      orcid = fullAuthor?.orcid || undefined;
    }

    const author: OpenAlexAuthor = {
      id: best.id,
      displayName: best.display_name,
      orcid: orcid?.replace('https://orcid.org/', ''),
      lastKnownInstitutions: best.last_known_institutions || [],
    };

    return author;
  } catch (err) {
    logCaughtError(err, 'openalex', 'author-lookup', 'find-author', { name, affiliation });
    return null;
  }
}
