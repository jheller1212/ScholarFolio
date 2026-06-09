import type { Author } from '../../types/scholar';
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

function buildAuthorResult(data: any): Author {
  const cleanName = stripTitleSuffix(data.name || '');

  const publications = (data.publications || []).map(pub => ({
    ...pub,
    journalRanking: pub.journalRanking || findJournalRanking(pub.venue)
  }));

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
