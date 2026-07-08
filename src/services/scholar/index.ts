import type { Author, Publication } from '../../types/scholar';
import { findJournalRanking } from '../../data/journalRankings';
import { metricsCalculator } from '../metrics';
import { ApiError, timeoutSignal } from '../../utils/api';
import { normalizeAuthorNames } from '../../utils/names';
import { supabase } from '../../lib/supabase';
import { logCaughtError } from '../../lib/errorLogger';

export interface AuthorSearchResult {
  name: string;
  affiliation: string;
  imageUrl: string;
  authorId: string;
  citedBy: number;
  interests: string[];
}

export const scholarService = {
  searchAuthors: async (query: string): Promise<AuthorSearchResult[]> => {
    const errors: string[] = [];

    // Try edge function (SerpAPI) first
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase not configured');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/scholar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ action: 'search', query }),
          signal: timeoutSignal(10000)
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.profiles && data.profiles.length > 0) {
          return data.profiles;
        }
        // SerpAPI returned OK but no profiles — genuinely no results
        return [];
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Edge function HTTP ${response.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[ScholarService] Edge function author search failed:', msg);
      errors.push(msg);
    }

    const fullError = `Author search failed: ${errors.join(' | ')}`;
    console.error('[ScholarService]', fullError);
    logCaughtError(new Error(fullError), 'profile', 'ScholarService', 'searchAuthors', { query });
    throw new Error(fullError);
  },

  validateProfileUrl: (url: string) => {
    try {
      const urlObj = new URL(url);
      const isGoogleScholar = urlObj.hostname.includes('scholar.google.');
      const hasUserParam = urlObj.searchParams.has('user');
      const userId = urlObj.searchParams.get('user');
      const validUserIdFormat = userId && userId.length >= 12;
      const isValid = isGoogleScholar && hasUserParam && validUserIdFormat;
      return { isValid, userId: isValid ? userId : null };
    } catch (e) {
      return { isValid: false, userId: null };
    }
  },

  fetchProfile: async (profileUrl: string, options?: { cacheOnly?: boolean }): Promise<Author> => {
    const normalizedUrl = normalizeScholarUrl(profileUrl);

    // All fetching is performed server-side by the Supabase edge function.
    try {
      const data = await fetchViaEdgeFunction(normalizedUrl, options?.cacheOnly);
      return buildAuthorResult(data);
    } catch (err) {
      // Surface user-actionable errors directly
      if (err instanceof ApiError && (err.code === 'CREDITS_EXHAUSTED' || err.code === 'RATE_LIMITED')) {
        throw err;
      }
      const edgeMsg = err instanceof ApiError ? err.message : '';
      throw new ApiError(
        edgeMsg || 'Unable to fetch profile data. The service may be temporarily unavailable. Please try again later or contact the site administrator.',
        'FETCH_ERROR'
      );
    }
  }
};

async function fetchViaEdgeFunction(normalizedUrl: string, cacheOnly?: boolean) {
  // Get the current session token for authenticated credit tracking
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/scholar`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ profileUrl: normalizedUrl, ...(cacheOnly ? { cacheOnly: true } : {}) })
    }
  );

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP ${response.status}` };
    }
    // Map HTTP status codes to specific error codes for the caller
    let code = errorData.code || 'FETCH_ERROR';
    if (response.status === 403) code = 'CREDITS_EXHAUSTED';
    if (response.status === 429) code = 'RATE_LIMITED';
    throw new ApiError(errorData.error || 'Edge function error', code);
  }

  const data = await response.json();
  data.cacheStatus = response.headers.get('X-Cache') === 'HIT' ? 'hit' : 'miss';
  if (!data || !data.name) {
    throw new ApiError('Invalid profile data received', 'DATA_ERROR');
  }

  if (!data.metrics) data.metrics = { citationsPerYear: {} };
  if (!data.metrics.citationsPerYear) data.metrics.citationsPerYear = {};

  return data;
}

/** Strip academic title suffixes from profile names (e.g. "Name - Full Professor" → "Name") */
function stripTitleSuffix(name: string): string {
  return name.replace(/\s*[-–—]\s*(Full|Associate|Assistant|Emeritus|Adjunct|Visiting|Research|Senior|Junior|Distinguished|Clinical|Tenured)?\s*(Professor|Lecturer|Fellow|Director|Dean|Chair|Researcher|Scientist|Engineer|Doctor|PhD|Dr|MD|Instructor|Postdoc|PostDoc)\b.*/i, '').trim() || name;
}

/** Normalized title key (lowercase, alphanumeric words). */
function normalizeTitleKey(title: string): string {
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Journal/venue reduced to its alphabetic words, dropping volume/issue/page
 *  noise (e.g. "Journal of Service Research 26 (1), 3-20, 2023" → "journal of
 *  service research"). Used to confirm two title-variants are the same outlet. */
function normalizeVenueKey(venue: string): string {
  return (venue || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

/** Extract a bare DOI from a work URL, if present. */
function extractDoi(url: string): string {
  const m = (url || '').toLowerCase().match(/doi\.org\/(10\.\S+)/);
  return m ? m[1] : '';
}

interface DedupeEntry { pub: Publication; nt: string; doi: string; venue: string; }

/** Is `a` a duplicate of already-kept `b`? Three tiers, each strictly guarded so
 *  genuinely distinct works are never merged. */
function isDuplicatePub(a: DedupeEntry, b: DedupeEntry): boolean {
  if (!a.nt || !b.nt) return false;
  // 1. Exact: same normalized title + same year.
  if (a.nt === b.nt && (a.pub.year || 0) === (b.pub.year || 0)) return true;
  // 2. Same DOI ⇒ same work (independent of title/year formatting).
  if (a.doi && a.doi === b.doi) return true;
  // 3. Version / early-access: one title is a clean prefix of the other, in the
  //    same venue, within a few years (final vs online-first of one article).
  //    Guarded by a length floor so generic prefixes ("Introduction") never match.
  if (a.venue && a.venue === b.venue && Math.abs((a.pub.year || 0) - (b.pub.year || 0)) <= 3) {
    const [short, long] = a.nt.length <= b.nt.length ? [a.nt, b.nt] : [b.nt, a.nt];
    if (short.length >= 20 && (long === short || long.startsWith(short + ' '))) return true;
  }
  return false;
}

/** Prefer the richer record when merging duplicates: more citations, then the
 *  longer (usually final/complete) title, then the later year. */
function betterPub(a: Publication, b: Publication): Publication {
  if ((a.citations || 0) !== (b.citations || 0)) return (a.citations || 0) > (b.citations || 0) ? a : b;
  if ((a.title || '').length !== (b.title || '').length) return (a.title || '').length > (b.title || '').length ? a : b;
  return (a.year || 0) >= (b.year || 0) ? a : b;
}

/**
 * Collapse duplicate publication records so every downstream surface (narrative
 * counts, publication list, metrics, co-author stats, OA-tab title matching, CV
 * export) sees one canonical entry per work. Runs once here, the single assembly
 * point for both Google Scholar and OpenAlex profiles. Tiers: exact title+year,
 * same DOI, and version/early-access (same-venue title-prefix). See isDuplicatePub
 * for the guards that prevent merging genuinely distinct works.
 */
function dedupePublications(pubs: Publication[]): Publication[] {
  const kept: DedupeEntry[] = [];
  for (const pub of pubs) {
    const entry: DedupeEntry = {
      pub,
      nt: normalizeTitleKey(pub.title),
      doi: extractDoi(pub.url),
      venue: normalizeVenueKey(pub.venue),
    };
    if (!entry.nt) { kept.push(entry); continue; } // no title — can't safely dedupe
    const dupIdx = kept.findIndex(k => isDuplicatePub(entry, k));
    if (dupIdx === -1) {
      kept.push(entry);
    } else {
      const winner = betterPub(kept[dupIdx].pub, pub);
      kept[dupIdx] = {
        pub: winner,
        nt: normalizeTitleKey(winner.title),
        doi: extractDoi(winner.url) || kept[dupIdx].doi,
        venue: normalizeVenueKey(winner.venue) || kept[dupIdx].venue,
      };
    }
  }
  return kept.map(k => k.pub);
}

export function buildAuthorResult(data: any): Author {
  const cleanName = stripTitleSuffix(data.name || '');

  const publications = dedupePublications(
    (data.publications || []).map(pub => ({
      ...pub,
      journalRanking: pub.journalRanking || findJournalRanking(pub.venue)
    }))
  );

  // Merge near-duplicate author names (case, middle names, initials)
  normalizeAuthorNames(publications);

  const metrics = metricsCalculator.calculateMetrics(
    publications,
    data.metrics?.citationsPerYear || {},
    cleanName
  );

  // Propagate the citation graph source from the edge function response
  if (data.metrics?.citationGraphSource) {
    metrics.citationGraphSource = data.metrics.citationGraphSource;
  }

  return {
    name: cleanName,
    affiliation: data.affiliation || '',
    imageUrl: data.imageUrl,
    topics: data.topics || [],
    hIndex: data.hIndex || 0,
    totalCitations: data.totalCitations || 0,
    publications,
    metrics,
    cacheStatus: data.cacheStatus
  };
}

/**
 * Normalizes a Google Scholar URL to a standard format
 * Handles different country domains and extracts only the essential user parameter
 */
function normalizeScholarUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a Google Scholar URL
    if (!urlObj.hostname.includes('scholar.google.')) {
      throw new Error('Not a Google Scholar URL');
    }
    
    // Extract the user ID
    const userId = urlObj.searchParams.get('user');
    if (!userId) {
      throw new Error('Missing user ID in URL');
    }
    
    // Create a clean normalized URL with just the user parameter
    const normalizedUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`;
    
    return normalizedUrl;
  } catch (e) {
    console.error('[ScholarService] Error normalizing URL:', e);
    return url; // Return original if normalization fails
  }
}
