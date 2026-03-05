import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getJson } from "npm:serpapi@2.0.0";
import DOMPurify from "npm:dompurify@3.0.8";
import { JSDOM } from "npm:jsdom@24.0.0";

// Initialize DOMPurify with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CACHE_DURATION = 3600; // 1 hour in seconds
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function fetchScholarProfile(authorId) {
  try {
    // Validate authorId format
    if (!authorId || typeof authorId !== 'string' || authorId.length < 12) {
      throw new Error("Invalid author ID format");
    }
    
    console.log(`Fetching profile for author ID: ${authorId}`);
    
    const params = {
      api_key: SERPAPI_KEY,
      engine: "google_scholar_author",
      author_id: authorId,
    };

    const authorData = await getJson(params);
    
    if (!authorData.author) {
      console.error("Author profile not found:", authorData);
      throw new Error("Author profile not found");
    }
    
    // Fetch author's publications
    const publicationsParams = {
      ...params,
      engine: "google_scholar_author",
      author_id: authorId,
      sort: "pubdate",
      num: 100
    };

    const publicationsData = await getJson(publicationsParams);

    if (!publicationsData.articles) {
      console.error("No publications data found:", publicationsData);
      throw new Error("Failed to fetch publications");
    }

    // Transform publications to match frontend schema
    const publications = (publicationsData.articles || []).map(article => ({
      title: article.title || "",
      authors: (article.authors || "").split(", "),
      venue: article.publication || "",
      year: parseInt(article.year) || new Date().getFullYear(),
      citations: parseInt(article.cited_by?.value) || 0,
      url: article.link || ""
    }));

    // Calculate total citations
    const totalCitations = publications.reduce((sum, pub) => sum + pub.citations, 0);

    // Calculate h-index
    const citations = publications.map(p => p.citations);
    const { hIndex, gIndex, i10Index } = calculateIndices(citations);

    // Calculate citations per year
    const citationsPerYear = {};
    publications.forEach(pub => {
      if (pub.year) {
        const yearStr = String(pub.year);
        citationsPerYear[yearStr] = (citationsPerYear[yearStr] || 0) + pub.citations;
      }
    });

    // Calculate metrics
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
      soloAuthorScore: calculateSoloAuthorScore(publications, authorData.author?.name),
      averageAuthors: calculateAverageAuthors(publications),
      totalCoAuthors: calculateTotalCoAuthors(publications, authorData.author?.name),
      topCoAuthor: findTopCoAuthor(publications, authorData.author?.name)
    };

    // Transform topics/interests
    const topics = authorData.author?.interests?.map(interest => ({
      name: interest,
      url: `https://scholar.google.com/citations?view_op=search_authors&mauthors=${encodeURIComponent(interest)}`,
      paperCount: 0 // SerpAPI doesn't provide this information
    })) || [];

    return {
      name: authorData.author?.name || "",
      affiliation: authorData.author?.affiliations?.[0] || "",
      imageUrl: authorData.author?.thumbnail || "",
      topics,
      hIndex,
      metrics,
      totalCitations,
      publications
    };
  } catch (error) {
    console.error("Error fetching from SerpAPI:", error);
    throw new Error(`Failed to fetch scholar data: ${error.message}`);
  }
}

function calculateIndices(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return { hIndex: 0, gIndex: 0, i10Index: 0 };
  }
  
  const sorted = [...citations].sort((a, b) => b - a);
  
  // h-index
  let hIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) hIndex = i + 1;
    else break;
  }

  // g-index
  let gIndex = 0;
  const cumSum = sorted.reduce((acc, curr, i) => {
    acc[i] = (acc[i - 1] || 0) + curr;
    return acc;
  }, []);
  
  for (let i = 0; i < cumSum.length; i++) {
    if (cumSum[i] >= Math.pow(i + 1, 2)) gIndex = i + 1;
    else break;
  }

  // i10-index
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

// Extract user ID from various Google Scholar URLs
function extractScholarUserId(url) {
  try {
    // First try to parse as URL to validate
    const urlObj = new URL(url);
    
    // Check if it's a Google Scholar URL
    if (!urlObj.hostname.includes('scholar.google.')) {
      throw new Error('Not a Google Scholar URL');
    }
    
    // Extract user ID parameter
    const userId = urlObj.searchParams.get('user');
    if (!userId || userId.length < 12) {
      throw new Error('Invalid or missing user ID in URL');
    }
    
    // Sanitize user ID (should only contain alphanumeric and some special chars)
    const sanitizedUserId = purify.sanitize(userId, {ALLOWED_TAGS: [], ALLOWED_ATTR: []});
    if (sanitizedUserId !== userId) {
      throw new Error('User ID contains invalid characters');
    }
    
    return sanitizedUserId;
  } catch (e) {
    console.error('Error extracting user ID:', e);
    throw new Error('Invalid URL format. Please provide a valid Google Scholar profile URL.');
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request body
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
    
    const { profileUrl } = requestData;
    
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

    // Extract user ID from URL
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
    
    // Create normalized URL for caching
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
    
    // Fetch fresh data
    const data = await fetchScholarProfile(authorId);

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