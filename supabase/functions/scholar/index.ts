import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { DOMParser } from "npm:linkedom@0.16.8";

const ALLOWED_ORIGINS = [
  'https://scholarfolio.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// In-flight request coalescing to prevent duplicate API calls
const inflightRequests = new Map<string, Promise<any>>();

// --- IP-based rate limiting (in-memory, per edge function instance) ---
const ipRequestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 3600_000; // 1 hour in ms
const RATE_LIMIT_MAX_PROFILE = 10;  // max profile fetches per IP per hour
const RATE_LIMIT_MAX_SEARCH = 20;   // max name searches per IP per hour
const ANON_DAILY_LIMIT = 5;         // max profile fetches per IP per day (anonymous)
const ANON_DAILY_WINDOW = 86400_000;

function checkRateLimit(ip: string, limit: number, window: number = RATE_LIMIT_WINDOW): boolean {
  const now = Date.now();
  const timestamps = ipRequestLog.get(ip) || [];
  const recent = timestamps.filter(t => t > now - window);
  ipRequestLog.set(ip, recent);
  if (recent.length >= limit) return false; // rate limited
  recent.push(now);
  return true; // allowed
}

function getRequestIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// Clean up old entries every 10 minutes to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - ANON_DAILY_WINDOW;
  for (const [ip, timestamps] of ipRequestLog) {
    const recent = timestamps.filter(t => t > cutoff);
    if (recent.length === 0) ipRequestLog.delete(ip);
    else ipRequestLog.set(ip, recent);
  }
}, 600_000);

const CACHE_DURATION = 259200; // 72 hours (3 days) in seconds
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// --- SerpAPI fetch (primary) ---
async function fetchViaSerpAPI(authorId: string) {
  console.log(`[SerpAPI] Fetching profile for author ID: ${authorId}`);

  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  // First request — get author profile + first page of articles
  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);
  serpUrl.searchParams.set('engine', 'google_scholar_author');
  serpUrl.searchParams.set('author_id', authorId);
  serpUrl.searchParams.set('sort', 'pubdate');
  serpUrl.searchParams.set('num', '100');
  serpUrl.searchParams.set('start', '0');

  const serpResponse = await fetch(serpUrl.toString());
  if (!serpResponse.ok) {
    const errText = await serpResponse.text();
    console.error("[SerpAPI] HTTP error:", serpResponse.status, errText);
    const err = new Error(`SerpAPI error: ${serpResponse.status}`);
    (err as any).status = serpResponse.status;
    throw err;
  }
  const authorData = await serpResponse.json();

  if (!authorData.author) {
    throw new Error("Author profile not found");
  }

  if (!authorData.articles) {
    throw new Error("Failed to fetch publications");
  }

  // Collect all articles across pages (max 10 pages = 1000 articles as safety limit)
  let allArticles = [...(authorData.articles || [])];
  let start = allArticles.length;
  const MAX_PAGES = 10;

  for (let page = 1; page < MAX_PAGES; page++) {
    // Stop if the first page returned fewer than 100 — no more pages
    if (allArticles.length < start) break;

    const nextUrl = new URL('https://serpapi.com/search.json');
    nextUrl.searchParams.set('api_key', SERPAPI_KEY);
    nextUrl.searchParams.set('engine', 'google_scholar_author');
    nextUrl.searchParams.set('author_id', authorId);
    nextUrl.searchParams.set('sort', 'pubdate');
    nextUrl.searchParams.set('num', '100');
    nextUrl.searchParams.set('start', String(start));

    const nextResponse = await fetch(nextUrl.toString());
    if (!nextResponse.ok) {
      console.warn(`[SerpAPI] Pagination page ${page + 1} failed (HTTP ${nextResponse.status}), stopping`);
      break;
    }

    const nextData = await nextResponse.json();
    const nextArticles = nextData.articles || [];

    if (nextArticles.length === 0) break;

    allArticles = allArticles.concat(nextArticles);
    start += nextArticles.length;
    console.log(`[SerpAPI] Page ${page + 1}: fetched ${nextArticles.length} articles (total: ${allArticles.length})`);

    // If fewer than 100 returned, we've reached the last page
    if (nextArticles.length < 100) break;
  }

  console.log(`[SerpAPI] Total articles fetched: ${allArticles.length}`);

  const publications = allArticles
    .filter(article => {
      const year = parseInt(article.year);
      const hasValidYear = !isNaN(year) && year > 0;
      const hasCitations = (parseInt(article.cited_by?.value) || 0) > 0;
      // Keep if valid year, or if no year but has citations; skip if no year and no citations
      return hasValidYear || hasCitations;
    })
    .map(article => {
      const year = parseInt(article.year);
      return {
        title: article.title || "",
        authors: (article.authors || "").split(", "),
        venue: article.publication || "",
        year: (!isNaN(year) && year > 0) ? year : 0,
        citations: parseInt(article.cited_by?.value) || 0,
        url: article.link || ""
      };
    });

  const topics = (authorData.author?.interests || []).map((interest: any) => ({
    name: typeof interest === 'string' ? interest : (interest.title || ''),
    url: typeof interest === 'string'
      ? `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(interest)}`
      : (interest.link || ''),
    paperCount: 0
  }));

  // Extract actual citations-per-year from SerpAPI's cited_by.graph
  // The graph lives under author.cited_by.graph (NOT top-level cited_by_graph).
  // Each entry has { year: number, citations: number|string }.
  const citationsPerYear: Record<string, number> = {};
  const graph = authorData.cited_by?.graph || authorData.cited_by_graph || [];
  for (const entry of graph) {
    if (entry.year != null && entry.citations != null) {
      citationsPerYear[String(entry.year)] = parseInt(String(entry.citations)) || 0;
    }
  }
  console.log(`[SerpAPI] cited_by.graph: ${graph.length} entries, citationsPerYear keys: ${Object.keys(citationsPerYear).length}`);

  return {
    name: authorData.author?.name || "",
    affiliation: authorData.author?.affiliations || "",
    imageUrl: authorData.author?.thumbnail || "",
    topics,
    publications,
    citationsPerYear
  };
}

// --- Direct Google Scholar scraping (fallback) ---

/** Parse publications from a Google Scholar profile HTML document */
function parsePublicationsFromHtml(doc: any): any[] {
  const publications: any[] = [];
  const rows = doc.querySelectorAll('#gsc_a_b .gsc_a_tr');

  for (const row of Array.from(rows)) {
    const titleEl = (row as any).querySelector('.gsc_a_t a');
    const title = titleEl?.textContent?.trim();
    const url = titleEl?.getAttribute('href') || '';

    const authorVenueEls = (row as any).querySelectorAll('.gsc_a_t .gs_gray');
    const authors = (authorVenueEls[0]?.textContent || "").split(',').map((a: string) => a.trim()).filter(Boolean);
    const venue = authorVenueEls[1]?.textContent?.trim() || '';

    const yearEl = (row as any).querySelector('.gsc_a_y span');
    const citationsEl = (row as any).querySelector('.gsc_a_c a');

    const yearText = yearEl?.textContent?.trim() || '';
    const citationsText = citationsEl?.textContent?.trim() || '0';

    const year = parseInt(yearText);
    const citations = parseInt(citationsText.replace('*', '')) || 0;
    // Skip if no title, or if no valid year and no citations
    if (!title || (isNaN(year) && citations === 0)) continue;

    publications.push({
      title,
      authors: authors.length > 0 ? authors : ['Unknown'],
      venue,
      year: (!isNaN(year) && year > 0) ? year : 0,
      citations,
      url: url.startsWith('http') ? url : `https://scholar.google.com${url}`
    });
  }

  return publications;
}

const SCRAPER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache'
};

async function fetchViaDirectScraping(authorId: string) {
  console.log(`[Scraper] Falling back to direct scraping for author ID: ${authorId}`);

  const scholarUrl = `https://scholar.google.com/citations?user=${authorId}&hl=en&sortby=pubdate&pagesize=100`;

  const response = await fetch(scholarUrl, {
    headers: SCRAPER_HEADERS,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Google Scholar returned HTTP ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('unusual traffic') || html.includes('please show you') || html.includes('automated access')) {
    throw new Error("Rate limited by Google Scholar (CAPTCHA). Please try again later.");
  }

  if (!html.includes('gsc_prf_in')) {
    throw new Error("Could not parse Scholar profile. The profile may be private or the URL incorrect.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Parse author name
  const nameEl = doc.querySelector('#gsc_prf_in');
  const name = nameEl?.textContent?.trim() || "";

  // Parse affiliation
  const affiliationEl = doc.querySelector('.gsc_prf_il');
  const affiliation = affiliationEl?.textContent?.trim() || "";

  // Parse profile image
  const imageEl = doc.querySelector('#gsc_prf_pup-img');
  const imageUrl = imageEl?.getAttribute('src') || "";

  // Parse topics/interests
  const topicEls = doc.querySelectorAll('#gsc_prf_int a');
  const topics = Array.from(topicEls).map(el => ({
    name: (el as any).textContent?.trim() || "",
    url: `https://scholar.google.com${(el as any).getAttribute('href') || ''}`,
    paperCount: 0
  }));

  // Parse first page of publications
  let publications = parsePublicationsFromHtml(doc);
  console.log(`[Scraper] Page 1: ${publications.length} publications`);

  // Paginate to get remaining publications (max 5 extra pages to limit CAPTCHA risk)
  const MAX_SCRAPE_PAGES = 5;
  let cstart = publications.length;

  for (let page = 1; page < MAX_SCRAPE_PAGES && publications.length >= cstart; page++) {
    if (publications.length < 100 * page) break; // Last page had fewer than 100

    const nextUrl = `https://scholar.google.com/citations?user=${authorId}&hl=en&sortby=pubdate&pagesize=100&cstart=${cstart}`;
    try {
      const nextResponse = await fetch(nextUrl, {
        headers: SCRAPER_HEADERS,
        signal: AbortSignal.timeout(15000)
      });

      if (!nextResponse.ok) break;
      const nextHtml = await nextResponse.text();
      if (nextHtml.includes('unusual traffic') || nextHtml.includes('please show you')) break;

      const nextDoc = parser.parseFromString(nextHtml, 'text/html');
      const nextPubs = parsePublicationsFromHtml(nextDoc);

      if (nextPubs.length === 0) break;

      publications = publications.concat(nextPubs);
      cstart += nextPubs.length;
      console.log(`[Scraper] Page ${page + 1}: ${nextPubs.length} publications (total: ${publications.length})`);

      if (nextPubs.length < 100) break;
    } catch (e) {
      console.warn(`[Scraper] Pagination page ${page + 1} failed: ${e.message}`);
      break;
    }
  }

  if (publications.length === 0 && !name) {
    throw new Error("Failed to parse any data from Scholar profile");
  }

  // Parse citations-per-year graph from the profile page.
  // The main chart lives in #gsc_rsb_cit; the modal uses .gsc_md_hist_b.
  const citationsPerYear: Record<string, number> = {};
  let yearEls = doc.querySelectorAll('#gsc_rsb_cit .gsc_g_t');
  let barEls = doc.querySelectorAll('#gsc_rsb_cit .gsc_g_al');
  if (!yearEls.length || yearEls.length !== barEls.length) {
    yearEls = doc.querySelectorAll('.gsc_md_hist_b .gsc_g_t');
    barEls = doc.querySelectorAll('.gsc_md_hist_b .gsc_g_al');
  }
  if (yearEls.length > 0 && yearEls.length === barEls.length) {
    for (let i = 0; i < yearEls.length; i++) {
      const year = yearEls[i]?.textContent?.trim();
      const citations = parseInt(barEls[i]?.textContent?.trim() || '0') || 0;
      if (year) {
        citationsPerYear[year] = citations;
      }
    }
  }

  return { name, affiliation, imageUrl, topics, publications, citationsPerYear };
}

// --- Main fetch with fallback ---
async function fetchScholarProfile(authorId: string) {
  if (!authorId || typeof authorId !== 'string' || authorId.length < 12) {
    throw new Error("Invalid author ID format");
  }

  let rawData: { name: string; affiliation: string; imageUrl: string; topics: any[]; publications: any[]; citationsPerYear?: Record<string, number> };
  let source = 'serpapi';

  try {
    rawData = await fetchViaSerpAPI(authorId);
    console.log(`[Fetch] Successfully fetched via SerpAPI (${rawData.publications.length} publications)`);
  } catch (serpError) {
    const status = (serpError as any).status;
    console.warn(`[Fetch] SerpAPI failed (status=${status}): ${serpError.message}`);

    // Always fall back to direct scraping when SerpAPI fails for any reason
    console.log("[Fetch] Attempting direct scraping fallback...");
    try {
      rawData = await fetchViaDirectScraping(authorId);
      source = 'scraper';
      console.log(`[Fetch] Successfully fetched via scraping (${rawData.publications.length} publications)`);
    } catch (scrapeError) {
      console.error("[Fetch] Scraping fallback also failed:", scrapeError.message);
      throw new Error(`Both SerpAPI and direct scraping failed. SerpAPI: ${serpError.message}. Scraper: ${scrapeError.message}`);
    }
  }

  // Build unified response from either source
  const { name, affiliation, imageUrl, topics, publications } = rawData;

  // Merge near-duplicate author names (case, middle names, initials)
  mergeAuthorNames(publications);

  const totalCitations = publications.reduce((sum, pub) => sum + pub.citations, 0);
  const citations = publications.map(p => p.citations);
  const { hIndex, gIndex, i10Index } = calculateIndices(citations);

  // Use actual citations-per-year graph from SerpAPI cited_by_graph or scraped
  // from the profile page. These match the Google Scholar bar chart exactly.
  // Never fall back to publication-year sums — that's a different metric entirely.
  const citationsPerYear: Record<string, number> = rawData.citationsPerYear && Object.keys(rawData.citationsPerYear).length > 0
    ? rawData.citationsPerYear
    : {};
  const citationGraphSource = Object.keys(citationsPerYear).length > 0
    ? (source === 'serpapi' ? 'cited_by_graph' : 'scraped_chart')
    : 'none';
  console.log(`[Metrics] Citation graph: ${citationGraphSource} (${Object.keys(citationsPerYear).length} years)`);

  const metrics = {
    hIndex,
    gIndex,
    i10Index,
    totalPublications: publications.length,
    publicationsPerYear: (publications.length / Math.max(1, Object.keys(citationsPerYear).length)).toFixed(1),
    citationsPerYear,
    citationGraphSource,
    avgCitationsPerYear: Math.round(totalCitations / Math.max(1, Object.keys(citationsPerYear).length)),
    avgCitationsPerPaper: Math.round(totalCitations / Math.max(1, publications.length)),
    collaborationScore: calculateCollaborationScore(publications),
    soloAuthorScore: calculateSoloAuthorScore(publications, name),
    averageAuthors: calculateAverageAuthors(publications),
    totalCoAuthors: calculateTotalCoAuthors(publications, name),
    topCoAuthor: findTopCoAuthor(publications, name)
  };

  return {
    name,
    affiliation,
    imageUrl,
    topics,
    hIndex,
    metrics,
    totalCitations,
    publications,
    _source: source
  };
}

/** Merge near-duplicate author names across publications (case, middle names, initials). */
function mergeAuthorNames(publications: any[]) {
  const lastNamePrefixes = ['van ', 'von ', 'de ', 'del ', 'della ', 'di ', 'da ', 'dos ', 'das ', 'du ', 'den ', 'der ', 'la ', 'le ', 'el ', 'al-'];

  function extractLast(fullName: string): string {
    const parts = fullName.trim().split(' ');
    if (parts.length <= 1) return parts[0] || '';
    for (let i = 1; i < parts.length - 1; i++) {
      if (lastNamePrefixes.includes(parts[i].toLowerCase() + ' ')) return parts.slice(i).join(' ');
    }
    return parts[parts.length - 1];
  }

  function fuzzyKey(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const lastName = extractLast(trimmed).toLowerCase().replace(/[.,]/g, '');
    const firstInitial = trimmed.split(/\s+/)[0]?.[0]?.toLowerCase() || '';
    return `${lastName}|${firstInitial}`;
  }

  const nameFreq = new Map<string, number>();
  for (const pub of publications) {
    for (const a of (pub.authors || [])) {
      nameFreq.set(a, (nameFreq.get(a) || 0) + 1);
    }
  }

  const groups = new Map<string, string[]>();
  for (const name of nameFreq.keys()) {
    const key = fuzzyKey(name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(name);
  }

  const replacements = new Map<string, string>();
  for (const variants of groups.values()) {
    if (variants.length <= 1) continue;
    const lastNames = new Set(variants.map(v => extractLast(v).toLowerCase().replace(/[.,]/g, '')));
    if (lastNames.size > 1) continue;
    const canonical = variants.sort((a, b) => {
      const lenDiff = b.length - a.length;
      return lenDiff !== 0 ? lenDiff : (nameFreq.get(b) || 0) - (nameFreq.get(a) || 0);
    })[0];
    for (const v of variants) {
      if (v !== canonical) replacements.set(v, canonical);
    }
  }

  if (replacements.size > 0) {
    for (const pub of publications) {
      if (pub.authors) {
        pub.authors = pub.authors.map((a: string) => replacements.get(a) || a);
      }
    }
  }
}

function calculateIndices(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return { hIndex: 0, gIndex: 0, i10Index: 0 };
  }

  const sorted = [...citations].sort((a, b) => b - a);

  let hIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) hIndex = i + 1;
    else break;
  }

  let gIndex = 0;
  const cumSum = sorted.reduce((acc, curr, i) => {
    acc[i] = (acc[i - 1] || 0) + curr;
    return acc;
  }, []);

  for (let i = 0; i < cumSum.length; i++) {
    if (cumSum[i] >= Math.pow(i + 1, 2)) gIndex = i + 1;
    else break;
  }

  const i10Index = sorted.filter(c => c >= 10).length;

  return { hIndex, gIndex, i10Index };
}

function calculateCollaborationScore(publications) {
  if (!publications || publications.length === 0) return 0;
  const multiAuthorPubs = publications.filter(pub => pub.authors && pub.authors.length > 1);
  return Math.round((multiAuthorPubs.length / publications.length) * 100);
}

function calculateSoloAuthorScore(publications, authorName) {
  if (!publications || publications.length === 0 || !authorName) return 0;
  const soloAuthorPubs = publications.filter(pub =>
    pub.authors && pub.authors.length === 1 &&
    pub.authors[0].toLowerCase().includes(authorName.toLowerCase())
  );
  return Math.round((soloAuthorPubs.length / publications.length) * 100);
}

function calculateAverageAuthors(publications) {
  if (!publications || publications.length === 0) return 0;
  const totalAuthors = publications.reduce((sum, pub) => sum + (pub.authors?.length || 0), 0);
  return parseFloat((totalAuthors / publications.length).toFixed(1));
}

function calculateTotalCoAuthors(publications, authorName) {
  if (!publications || publications.length === 0 || !authorName) return 0;
  const coAuthors = new Set();
  const authorNameLower = authorName.toLowerCase();
  publications.forEach(pub => {
    if (pub.authors) {
      pub.authors.forEach(author => {
        if (!author.toLowerCase().includes(authorNameLower)) {
          coAuthors.add(author);
        }
      });
    }
  });
  return coAuthors.size;
}

function findTopCoAuthor(publications, authorName) {
  if (!publications || publications.length === 0 || !authorName) return '';
  const coAuthorCounts = new Map();
  const authorNameLower = authorName.toLowerCase();
  publications.forEach(pub => {
    if (pub.authors) {
      pub.authors.forEach(author => {
        if (!author.toLowerCase().includes(authorNameLower)) {
          coAuthorCounts.set(author, (coAuthorCounts.get(author) || 0) + 1);
        }
      });
    }
  });

  let topCoAuthor = '';
  let maxCollabs = 0;
  coAuthorCounts.forEach((count, author) => {
    if (count > maxCollabs) {
      maxCollabs = count;
      topCoAuthor = author;
    }
  });
  return topCoAuthor;
}

async function logRequest(
  req: Request,
  authorId: string,
  source: 'serpapi' | 'scraper' | 'cache',
  userId?: string | null
) {
  try {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const origin = req.headers.get('Origin') || null;
    const userAgent = req.headers.get('User-Agent') || null;

    await supabase.from('request_logs').insert({
      author_id: authorId,
      source,
      ip,
      origin,
      user_agent: userAgent,
      user_id: userId || null,
    });
  } catch (e) {
    console.error('[logRequest] Failed to log request:', e);
  }
}

function extractScholarUserId(url) {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('scholar.google.')) {
      throw new Error('Not a Google Scholar URL');
    }
    const userId = urlObj.searchParams.get('user');
    if (!userId || userId.length < 12) {
      throw new Error('Invalid or missing user ID in URL');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('User ID contains invalid characters');
    }
    return userId;
  } catch (e) {
    console.error('Error extracting user ID:', e);
    throw new Error('Invalid URL format. Please provide a valid Google Scholar profile URL.');
  }
}

// --- Author search by name via SerpAPI ---
async function searchAuthorsByNameSerpAPI(query: string) {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);
  serpUrl.searchParams.set('engine', 'google_scholar_profiles');
  serpUrl.searchParams.set('mauthors', query);

  const response = await fetch(serpUrl.toString());
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`SerpAPI profiles search error: ${response.status} — ${errBody}`);
  }

  const data = await response.json();
  const profiles = (data.profiles || []).slice(0, 8).map((p: any) => ({
    name: p.name || '',
    affiliation: p.affiliations || '',
    imageUrl: p.thumbnail || '',
    authorId: p.author_id || '',
    citedBy: p.cited_by ?? 0,
    interests: (p.interests || []).map((i: any) => i.title || ''),
  }));

  return profiles;
}

// --- Author search by name via direct scraping (fallback) ---
async function searchAuthorsByNameScraping(query: string) {
  const searchUrl = `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(query)}&hl=en`;

  console.log(`[Search-Scraper] Scraping author search for: ${query}`);

  const response = await fetch(searchUrl, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Google Scholar returned HTTP ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('unusual traffic') || html.includes('please show you') || html.includes('automated access')) {
    throw new Error("Rate limited by Google Scholar (CAPTCHA)");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const profiles: any[] = [];
  const profileCards = doc.querySelectorAll('.gsc_1usr');

  for (const card of Array.from(profileCards)) {
    const nameEl = card.querySelector('.gs_ai_name a');
    const name = nameEl?.textContent?.trim() || '';
    const profileLink = nameEl?.getAttribute('href') || '';

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

    profiles.push({ name, affiliation, imageUrl, authorId, citedBy, interests });
  }

  return profiles.slice(0, 8);
}

// --- Author search with fallback ---
async function searchAuthorsByName(query: string) {
  // Try SerpAPI first (most reliable)
  try {
    const results = await searchAuthorsByNameSerpAPI(query);
    console.log(`[Search] SerpAPI returned ${results.length} profiles`);
    return results;
  } catch (e) {
    console.warn(`[Search] SerpAPI failed: ${e.message}`);
  }

  // Fallback: scrape Google Scholar directly (server-side, no CORS issues)
  try {
    const results = await searchAuthorsByNameScraping(query);
    console.log(`[Search] Scraping fallback returned ${results.length} profiles`);
    return results;
  } catch (e) {
    console.warn(`[Search] Scraping fallback also failed: ${e.message}`);
    throw new Error(`Author search failed. SerpAPI and scraping both unavailable. Last error: ${e.message}`);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid request format", details: e.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { profileUrl, action, query } = requestData;
    const clientIp = getRequestIp(req);

    // --- Authenticate user via JWT ---
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    let userId: string | null = null;

    // Try to get authenticated user from JWT
    if (jwt && jwt !== (Deno.env.get('SUPABASE_ANON_KEY') ?? '')) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(jwt);
      if (!authError && authUser) {
        userId = authUser.id;
      }
    }

    // --- Author search by name (no credit cost, but rate limited) ---
    if (action === 'search' && query) {
      if (!checkRateLimit(`search:${clientIp}`, RATE_LIMIT_MAX_SEARCH)) {
        return new Response(
          JSON.stringify({ error: "Too many searches. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[Search] Searching for authors: ${query}`);
      const results = await searchAuthorsByName(query);
      return new Response(
        JSON.stringify({ profiles: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profileUrl) {
      return new Response(
        JSON.stringify({ error: "Profile URL is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // --- Rate limit profile fetches ---
    // Per-hour limit for all users (prevents rapid-fire abuse)
    if (!checkRateLimit(`profile:${clientIp}`, RATE_LIMIT_MAX_PROFILE)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tighter daily limit for anonymous users (server-side enforcement)
    if (!userId && !checkRateLimit(`anon:${clientIp}`, ANON_DAILY_LIMIT, ANON_DAILY_WINDOW)) {
      return new Response(
        JSON.stringify({ error: "Daily search limit reached. Sign up for more free searches." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing request for URL: ${profileUrl}`);

    let authorId;
    try {
      authorId = extractScholarUserId(profileUrl);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`Extracted user ID: ${authorId}`);

    const normalizedUrl = `https://scholar.google.com/citations?user=${authorId}`;

    // Check cache
    const { data: cached, error: cacheError } = await supabase
      .from('scholar_cache')
      .select('data')
      .eq('url', normalizedUrl)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cacheError) {
      console.error("Cache lookup error:", cacheError);
    }

    if (cached?.data) {
      const hasCitationGraph = cached.data.metrics?.citationsPerYear
        && Object.keys(cached.data.metrics.citationsPerYear).length > 0;
      // Invalidate cache entries that were stored before pagination fix
      // (exactly 100 publications is suspicious — likely truncated)
      const pubCount = cached.data.publications?.length || 0;
      const likelyTruncated = pubCount === 100;

      if (hasCitationGraph && !likelyTruncated) {
        console.log("Cache hit for:", normalizedUrl);
        logRequest(req, authorId, 'cache', userId);
        return new Response(
          JSON.stringify(cached.data),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-Cache': 'HIT'
            }
          }
        );
      } else {
        console.log(`Cache hit but stale (citationGraph=${!!hasCitationGraph}, pubs=${pubCount}, truncated=${likelyTruncated}) — refetching:`, normalizedUrl);
      }
    }

    console.log("Cache miss, fetching fresh data");

    // Check credits for authenticated users before making expensive API calls
    let creditsRemaining: number | null = null;
    if (userId) {
      const { data: creditData, error: creditError } = await supabase
        .from('user_credits')
        .select('credits_remaining')
        .eq('user_id', userId)
        .maybeSingle();

      if (creditError) {
        console.error("Credit check error:", creditError);
      }

      creditsRemaining = creditData?.credits_remaining ?? 0;
      if (creditsRemaining <= 0) {
        return new Response(
          JSON.stringify({ error: "No credits remaining. Please purchase more searches." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Coalesce concurrent requests for the same author
    let dataPromise = inflightRequests.get(authorId);
    if (!dataPromise) {
      dataPromise = fetchScholarProfile(authorId).finally(() => {
        inflightRequests.delete(authorId);
      });
      inflightRequests.set(authorId, dataPromise);
    } else {
      console.log("Coalescing with in-flight request for:", authorId);
    }

    const data = await dataPromise;

    // Cache the result
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + CACHE_DURATION);

    const { error: upsertError } = await supabase
      .from('scholar_cache')
      .upsert({
        url: normalizedUrl,
        data,
        expires_at: expiresAt.toISOString()
      });

    if (upsertError) {
      console.error("Cache update error:", upsertError);
    } else {
      console.log("Successfully cached data for:", normalizedUrl);
    }

    logRequest(req, authorId, data._source === 'scraper' ? 'scraper' : 'serpapi', userId);

    // Decrement user credits (only for authenticated users, only for fresh fetches)
    if (userId && creditsRemaining !== null) {
      const { error: decrError } = await supabase.rpc('decrement_credits', { p_user_id: userId });
      if (decrError) {
        // Use raw SQL fallback if RPC not yet created
        await supabase
          .from('user_credits')
          .update({ credits_remaining: Math.max(0, creditsRemaining - 1) })
          .eq('user_id', userId);
      }
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to fetch scholar profile",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
