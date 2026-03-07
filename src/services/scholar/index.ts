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
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/scholar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({ action: 'search', query })
      }
    );

    if (!response.ok) {
      throw new ApiError('Author search failed', 'FETCH_ERROR');
    }

    const data = await response.json();
    return data.profiles || [];
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
  const citationsPerYear: Record<string, number> = {};
  publications.forEach(pub => {
    if (pub.year) {
      const y = String(pub.year);
      citationsPerYear[y] = (citationsPerYear[y] || 0) + pub.citations;
    }
  });

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