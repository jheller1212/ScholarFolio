import type { Context } from '@netlify/edge-functions';

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable anon key — safe to embed, same as client-side
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peGF4a3l3a29qb2NsZ2JqanVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyMjg5NTcsImV4cCI6MjA1NzgwNDk1N30.sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

const CRAWLER_AGENTS = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
];

const DEFAULT_TITLE = 'ScholarFolio — Academic Research Profiles';
const DEFAULT_DESCRIPTION =
  'Explore research profiles, citation metrics, and co-author networks for academics worldwide.';
const DEFAULT_IMAGE = 'https://scholarfolio.org/og-default.png';

interface ScholarData {
  name?: string;
  affiliation?: string;
  totalCitations?: number;
  hIndex?: number;
  imageUrl?: string;
}

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

async function fetchScholarData(userId: string): Promise<ScholarData | null> {
  const scholarUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`;
  const apiUrl = `${SUPABASE_URL}/rest/v1/scholar_cache?url=eq.${encodeURIComponent(scholarUrl)}&select=data&limit=1`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) return null;

    const rows = await res.json();
    if (!rows || rows.length === 0) return null;

    return rows[0].data as ScholarData;
  } catch {
    return null;
  }
}

function buildOgTags(data: ScholarData, userId: string): string {
  const title = data.name ? `${data.name} — ScholarFolio` : DEFAULT_TITLE;

  let description = DEFAULT_DESCRIPTION;
  if (data.name) {
    const parts: string[] = [];
    if (data.affiliation) parts.push(data.affiliation);
    if (data.totalCitations != null) parts.push(`${data.totalCitations} citations`);
    if (data.hIndex != null) parts.push(`h-index ${data.hIndex}`);
    if (parts.length > 0) description = parts.join(' · ');
  }

  const image = data.imageUrl || DEFAULT_IMAGE;
  const url = `https://scholarfolio.org/scholar/${encodeURIComponent(userId)}`;

  return `
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="ScholarFolio" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />`;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectOgTags(html: string, tags: string): string {
  // Remove any existing og: and twitter: meta tags from the static HTML
  const cleaned = html
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');

  // Inject new tags before </head>
  return cleaned.replace('</head>', `${tags}\n  </head>`);
}

export default async function handler(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  // Profile id from either the canonical path (/scholar/<id>) or the legacy
  // query form (?user=<id>) still present in previously shared links.
  let userId: string | null = url.searchParams.get('user');
  const pathMatch = url.pathname.match(/^\/scholar\/([^/]+)\/?$/);
  if (pathMatch) {
    try {
      userId = decodeURIComponent(pathMatch[1]);
    } catch {
      userId = null; // malformed percent-encoding — serve the plain shell
    }
  }
  const userAgent = req.headers.get('user-agent') || '';

  // Pass through non-crawler requests immediately
  if (!userId || !isCrawler(userAgent)) {
    return context.next();
  }

  // Fetch the original HTML from the SPA
  let originalResponse: Response;
  try {
    originalResponse = await context.next();
  } catch {
    return context.next();
  }

  // Only process HTML responses
  const contentType = originalResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return originalResponse;
  }

  let html: string;
  try {
    html = await originalResponse.text();
  } catch {
    return originalResponse;
  }

  // Fetch scholar data from Supabase cache
  const scholarData = await fetchScholarData(userId);
  const ogTags = buildOgTags(scholarData || {}, userId);
  const modifiedHtml = injectOgTags(html, ogTags);

  return new Response(modifiedHtml, {
    status: originalResponse.status,
    headers: {
      ...Object.fromEntries(originalResponse.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
