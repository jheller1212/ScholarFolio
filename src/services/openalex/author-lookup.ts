import { timeoutSignal } from '../../utils/api';
import { RateLimiter } from '../scholar/rate-limiter';

const API_URL = 'https://api.openalex.org';
const EMAIL = 'scholarfolio@scholarfolio.org';
export const OA_HEADERS = { 'User-Agent': `ScholarFolio/1.0 (mailto:${EMAIL})` };
export const OA_EMAIL = EMAIL;
export const OA_API_URL = API_URL;

/** Shared rate limiter for all OpenAlex calls */
export const oaRateLimiter = new RateLimiter(5000, 10);

/** Generic JSON fetcher with rate limiting and timeout */
export async function oaFetchJson<T>(url: string, timeoutMs = 15000): Promise<T | null> {
  try {
    await oaRateLimiter.acquireToken();
    const response = await fetch(url, { headers: OA_HEADERS, signal: timeoutSignal(timeoutMs) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
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

// In-memory cache: keyed by "name|affiliation", valid for the page session
const authorCache = new Map<string, OpenAlexAuthor | null>();

/**
 * Single consolidated OpenAlex author lookup.
 * 1. Searches by name (per_page=10)
 * 2. Filters by display_name match
 * 3. Refines by affiliation match
 * 4. Fetches ORCID from full author record
 * Results are cached per session so all 3 services share one lookup.
 */
export async function findOpenAlexAuthor(
  name: string,
  affiliation: string
): Promise<OpenAlexAuthor | null> {
  const cacheKey = `${name.toLowerCase().trim()}|${affiliation.toLowerCase().trim()}`;
  if (authorCache.has(cacheKey)) return authorCache.get(cacheKey)!;

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
      authorCache.set(cacheKey, null);
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

    authorCache.set(cacheKey, author);
    return author;
  } catch {
    authorCache.set(cacheKey, null);
    return null;
  }
}
