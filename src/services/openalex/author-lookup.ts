import { timeoutSignal } from '../../utils/api';
import { RateLimiter } from '../scholar/rate-limiter';
import { logCaughtError } from '../../lib/errorLogger';
import { canonicalNameKey, extractLastName, foldNamePunctuation, surnamesCompatible } from '../../utils/names';

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

/** Overlap between two institution strings, 0–1. Substring either way scores
 *  1; otherwise the share of the shorter name's significant words that appear
 *  in the other ("OWL University of Applied Sciences" vs "Ostwestfalen-Lippe
 *  University of Applied Sciences and Arts"). */
function institutionOverlap(a: string, b: string): number {
  const x = canonicalNameKey(a);
  const y = canonicalNameKey(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 1;
  const stop = new Set(['university', 'of', 'the', 'and', 'for', 'de', 'college', 'institute', 'school', 'center', 'centre', 'department']);
  const words = (s: string) => new Set(s.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.has(w)));
  const wx = words(x), wy = words(y);
  if (wx.size === 0 || wy.size === 0) return 0;
  const [small, large] = wx.size <= wy.size ? [wx, wy] : [wy, wx];
  let hits = 0;
  for (const w of small) if (large.has(w)) hits++;
  return hits / small.size;
}

/**
 * Uncached author resolution. OpenAlex frequently holds several records for
 * one researcher — a rich one carrying the ORCID and most works, plus sparse
 * duplicates with a handful. Picking the wrong one silently produces wrong
 * metrics (a 1-work duplicate reported "0% open access" for an author with 26
 * OA papers), so candidates are scored rather than taken in relevance order:
 * name match, affiliation overlap, ORCID presence, and works count.
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
      works_count?: number;
      last_known_institutions?: Array<{
        id: string;
        display_name: string;
        country_code: string;
      }>;
      affiliations?: Array<{ institution?: { display_name?: string } }>;
    }> }>(
      `${API_URL}/authors?search=${encodeURIComponent(name)}&per_page=10&select=id,display_name,orcid,works_count,last_known_institutions,affiliations&mailto=${EMAIL}`
    );

    const results = searchData?.results;
    if (!results?.length) {
      return null;
    }

    // Surname must be compatible, else it's a different person entirely —
    // better no OpenAlex data than another researcher's.
    const searchedLast = extractLastName(foldNamePunctuation(name));
    const plausible = results.filter(r =>
      surnamesCompatible(extractLastName(foldNamePunctuation(r.display_name)), searchedLast)
    );
    if (!plausible.length) return null;

    // canonicalNameKey folds the Unicode hyphen OpenAlex uses ("Pein‐
    // Hackelbusch"), which an exact string compare misses.
    const nameKey = canonicalNameKey(name);
    const affLower = affiliation || '';

    const score = (c: typeof plausible[number]): number => {
      let s = 0;
      if (canonicalNameKey(c.display_name) === nameKey) s += 100;
      if (affLower) {
        const insts = [
          c.last_known_institutions?.[0]?.display_name || '',
          ...(c.affiliations || []).map(a => a.institution?.display_name || ''),
        ].filter(Boolean);
        const best = insts.reduce((m, i) => Math.max(m, institutionOverlap(affLower, i)), 0);
        s += best * 50;
      }
      if (c.orcid) s += 20;
      // Prefer the fuller record; capped so works count can't outweigh identity.
      s += Math.min(c.works_count || 0, 200) / 10;
      return s;
    };

    let best = plausible[0];
    let bestScore = score(best);
    for (const candidate of plausible.slice(1)) {
      const s = score(candidate);
      if (s > bestScore) {
        best = candidate;
        bestScore = s;
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
