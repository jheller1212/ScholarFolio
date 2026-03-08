import type { Author } from '../../types/scholar';
import { findJournalRanking } from '../../data/journalRankings';
import { metricsCalculator } from '../metrics';
import { ApiError } from '../../utils/api';
import { scholarFetcher } from './fetcher';
import { scholarParser } from './parser';

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
          signal: AbortSignal.timeout(10000)
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

    // Fallback: scrape Google Scholar author search via CORS proxy
    try {
      return await searchAuthorsClientSide(query);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[ScholarService] Client-side author search also failed:', msg);
      errors.push(msg);
    }

    console.error('[ScholarService] All search methods failed:', errors);
    throw new Error(`Search failed: ${errors.join('; ')}`);
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

  fetchProfile: async (profileUrl: string): Promise<Author> => {
    const normalizedUrl = normalizeScholarUrl(profileUrl);

    // Try the Supabase edge function first (SerpAPI + server-side scraping)
    try {
      const data = await fetchViaEdgeFunction(normalizedUrl);
      return buildAuthorResult(data);
    } catch (edgeError) {
      console.warn('[ScholarService] Edge function failed, falling back to client-side scraping:', edgeError);
    }

    // Fallback: client-side scraping via CORS proxies
    try {
      const data = await fetchViaClientScraping(normalizedUrl);
      return buildAuthorResult(data);
    } catch (scrapeError) {
      console.error('[ScholarService] Client-side scraping also failed:', scrapeError);
      throw scrapeError instanceof ApiError
        ? scrapeError
        : new ApiError(
            scrapeError instanceof Error ? scrapeError.message : 'Failed to fetch scholar profile',
            'FETCH_ERROR'
          );
    }
  }
};

async function fetchViaEdgeFunction(normalizedUrl: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/scholar`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
      },
      body: JSON.stringify({ profileUrl: normalizedUrl })
    }
  );

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP ${response.status}` };
    }
    throw new ApiError(errorData.error || 'Edge function error', errorData.code || 'FETCH_ERROR');
  }

  const data = await response.json();
  if (!data || !data.name) {
    throw new ApiError('Invalid profile data received', 'DATA_ERROR');
  }

  if (!data.metrics) data.metrics = { citationsPerYear: {} };
  if (!data.metrics.citationsPerYear) data.metrics.citationsPerYear = {};

  return data;
}

async function fetchViaClientScraping(normalizedUrl: string) {
  console.log('[ScholarService] Attempting client-side scraping for:', normalizedUrl);
  const html = await scholarFetcher.fetch(normalizedUrl);
  const parser = scholarParser;
  const doc = parser.createDOM(html);

  const name = doc.querySelector('#gsc_prf_in')?.textContent?.trim() || '';
  const affiliation = doc.querySelector('.gsc_prf_il')?.textContent?.trim() || '';
  const imageUrl = doc.querySelector('#gsc_prf_pup-img')?.getAttribute('src') || '';

  const topicEls = doc.querySelectorAll('#gsc_prf_int a');
  const topics = Array.from(topicEls).map(el => ({
    name: (el as HTMLElement).textContent?.trim() || '',
    url: `https://scholar.google.com${el.getAttribute('href') || ''}`,
    paperCount: 0
  }));

  const publications = await parser.parsePublications(html);

  if (!name && publications.length === 0) {
    throw new ApiError('Could not parse any data from Scholar profile', 'DATA_ERROR');
  }

  const totalCitations = publications.reduce((sum, p) => sum + p.citations, 0);

  // Extract actual citations-per-year from the Google Scholar bar chart
  const citationsPerYear: Record<string, number> = {};
  const yearEls = doc.querySelectorAll('.gsc_md_hist_b .gsc_g_t');
  const barEls = doc.querySelectorAll('.gsc_md_hist_b .gsc_g_al');
  if (yearEls.length > 0 && yearEls.length === barEls.length) {
    for (let i = 0; i < yearEls.length; i++) {
      const year = (yearEls[i] as HTMLElement).textContent?.trim();
      const citations = parseInt((barEls[i] as HTMLElement).textContent?.trim() || '0') || 0;
      if (year) {
        citationsPerYear[year] = citations;
      }
    }
  }

  // Fallback: derive from publications if chart data not available
  if (Object.keys(citationsPerYear).length === 0) {
    publications.forEach(pub => {
      if (pub.year) {
        const y = String(pub.year);
        citationsPerYear[y] = (citationsPerYear[y] || 0) + pub.citations;
      }
    });
  }

  const citations = publications.map(p => p.citations).sort((a, b) => b - a);
  let hIndex = 0;
  for (let i = 0; i < citations.length; i++) {
    if (citations[i] >= i + 1) hIndex = i + 1;
    else break;
  }

  return {
    name,
    affiliation,
    imageUrl,
    topics,
    hIndex,
    totalCitations,
    publications,
    metrics: { citationsPerYear }
  };
}

function buildAuthorResult(data: any): Author {
  const publications = (data.publications || []).map(pub => ({
    ...pub,
    journalRanking: pub.journalRanking || findJournalRanking(pub.venue)
  }));

  const metrics = metricsCalculator.calculateMetrics(
    publications,
    data.metrics?.citationsPerYear || {},
    data.name
  );

  // Propagate the citation graph source from the edge function response
  if (data.metrics?.citationGraphSource) {
    metrics.citationGraphSource = data.metrics.citationGraphSource;
  }

  return {
    name: data.name,
    affiliation: data.affiliation || '',
    imageUrl: data.imageUrl,
    topics: data.topics || [],
    hIndex: data.hIndex || 0,
    totalCitations: data.totalCitations || 0,
    publications,
    metrics
  };
}

async function searchAuthorsClientSide(query: string): Promise<AuthorSearchResult[]> {
  const searchUrl = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(query)}&hl=en`;

  console.log('[ScholarService] Client-side author search for:', query);

  const html = await scholarFetcher.fetchRaw(searchUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const profiles: AuthorSearchResult[] = [];
  const profileCards = doc.querySelectorAll('.gsc_1usr');

  for (const card of Array.from(profileCards)) {
    const nameEl = card.querySelector('.gs_ai_name a');
    const name = nameEl?.textContent?.trim() || '';
    const profileLink = nameEl?.getAttribute('href') || '';

    // Extract author ID from profile link
    const authorIdMatch = profileLink.match(/user=([^&]+)/);
    const authorId = authorIdMatch ? authorIdMatch[1] : '';

    if (!name || !authorId) continue;

    const affiliation = card.querySelector('.gs_ai_aff')?.textContent?.trim() || '';
    const citedByText = card.querySelector('.gs_ai_cby')?.textContent?.trim() || '';
    const citedByMatch = citedByText.match(/(\d+)/);
    const citedBy = citedByMatch ? parseInt(citedByMatch[1]) : 0;

    const imageUrl = card.querySelector('.gs_ai_pho img')?.getAttribute('src') || '';

    const interestsEls = card.querySelectorAll('.gs_ai_one_int');
    const interests = Array.from(interestsEls).map(el => el.textContent?.trim() || '').filter(Boolean);

    profiles.push({
      name,
      affiliation,
      imageUrl: imageUrl.startsWith('http') ? imageUrl : imageUrl ? `https://scholar.google.com${imageUrl}` : '',
      authorId,
      citedBy,
      interests
    });
  }

  return profiles;
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
    
    console.log('[ScholarService] Normalized URL:', normalizedUrl);
    return normalizedUrl;
  } catch (e) {
    console.error('[ScholarService] Error normalizing URL:', e);
    return url; // Return original if normalization fails
  }
}