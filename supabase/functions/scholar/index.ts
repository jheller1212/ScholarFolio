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

const CACHE_DURATION = 86400; // 24 hours in seconds
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

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);
  serpUrl.searchParams.set('engine', 'google_scholar_author');
  serpUrl.searchParams.set('author_id', authorId);
  serpUrl.searchParams.set('sort', 'pubdate');
  serpUrl.searchParams.set('num', '100');

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

  const publications = (authorData.articles || []).map(article => ({
    title: article.title || "",
    authors: (article.authors || "").split(", "),
    venue: article.publication || "",
    year: parseInt(article.year) || new Date().getFullYear(),
    citations: parseInt(article.cited_by?.value) || 0,
    url: article.link || ""
  }));

  const topics = authorData.author?.interests?.map(interest => ({
    name: interest,
    url: `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(interest)}`,
    paperCount: 0
  })) || [];

  return {
    name: authorData.author?.name || "",
    affiliation: authorData.author?.affiliations || "",
    imageUrl: authorData.author?.thumbnail || "",
    topics,
    publications
  };
}

// --- Direct Google Scholar scraping (fallback) ---
async function fetchViaDirectScraping(authorId: string) {
  console.log(`[Scraper] Falling back to direct scraping for author ID: ${authorId}`);

  const scholarUrl = `https://scholar.google.com/citations?user=${authorId}&hl=en&sortby=pubdate&pagesize=100`;

  const response = await fetch(scholarUrl, {
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
    name: el.textContent?.trim() || "",
    url: `https://scholar.google.com${el.getAttribute('href') || ''}`,
    paperCount: 0
  }));

  // Parse publications
  const publications: any[] = [];
  const rows = doc.querySelectorAll('#gsc_a_b .gsc_a_tr');

  for (const row of Array.from(rows)) {
    const titleEl = row.querySelector('.gsc_a_t a');
    const title = titleEl?.textContent?.trim();
    const url = titleEl?.getAttribute('href') || '';

    const authorVenueEls = row.querySelectorAll('.gsc_a_t .gs_gray');
    const authors = (authorVenueEls[0]?.textContent || "").split(',').map(a => a.trim()).filter(Boolean);
    const venue = authorVenueEls[1]?.textContent?.trim() || '';

    const yearEl = row.querySelector('.gsc_a_y span');
    const citationsEl = row.querySelector('.gsc_a_c a');

    const yearText = yearEl?.textContent?.trim() || '';
    const citationsText = citationsEl?.textContent?.trim() || '0';

    const year = parseInt(yearText);
    if (!title || isNaN(year)) continue;

    publications.push({
      title,
      authors: authors.length > 0 ? authors : ['Unknown'],
      venue,
      year,
      citations: parseInt(citationsText.replace('*', '')) || 0,
      url: url.startsWith('http') ? url : `https://scholar.google.com${url}`
    });
  }

  if (publications.length === 0 && !name) {
    throw new Error("Failed to parse any data from Scholar profile");
  }

  return { name, affiliation, imageUrl, topics, publications };
}

// --- Main fetch with fallback ---
async function fetchScholarProfile(authorId: string) {
  if (!authorId || typeof authorId !== 'string' || authorId.length < 12) {
    throw new Error("Invalid author ID format");
  }

  let rawData: { name: string; affiliation: string; imageUrl: string; topics: any[]; publications: any[] };
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

  const totalCitations = publications.reduce((sum, pub) => sum + pub.citations, 0);
  const citations = publications.map(p => p.citations);
  const { hIndex, gIndex, i10Index } = calculateIndices(citations);

  const citationsPerYear = {};
  publications.forEach(pub => {
    if (pub.year) {
      const yearStr = String(pub.year);
      citationsPerYear[yearStr] = (citationsPerYear[yearStr] || 0) + pub.citations;
    }
  });

  const metrics = {
    hIndex,
    gIndex,
    i10Index,
    totalPublications: publications.length,
    publicationsPerYear: (publications.length / Math.max(1, Object.keys(citationsPerYear).length)).toFixed(1),
    citationsPerYear,
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
async function searchAuthorsByName(query: string) {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('api_key', SERPAPI_KEY);
  serpUrl.searchParams.set('engine', 'google_scholar_profiles');
  serpUrl.searchParams.set('mauthors', query);

  const response = await fetch(serpUrl.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI profiles search error: ${response.status}`);
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

    // --- Author search by name ---
    if (action === 'search' && query) {
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
      console.log("Cache hit for:", normalizedUrl);
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
    }

    console.log("Cache miss, fetching fresh data");

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
