import type { Context } from '@netlify/edge-functions';

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const SUPABASE_ANON_KEY = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

// Social preview bots AND search engines: search bots get a real title,
// canonical, meta description, and Person JSON-LD injected from the cache,
// so every /scholar/ page indexes as a unique structured document instead
// of the empty SPA shell. Cache-only — never triggers a paid fetch.
const CRAWLER_AGENTS = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'googlebot',
  'bingbot',
  'duckduckbot',
  'applebot',
  'yandex',
  'baiduspider',
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

async function fetchClaimedSlug(userId: string): Promise<string | null> {
  const apiUrl = `${SUPABASE_URL}/rest/v1/claimed_profiles?author_id=eq.${encodeURIComponent(userId)}&select=slug&limit=1`;
  try {
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}

function buildHead(data: ScholarData, userId: string, claimedSlug: string | null): { tags: string; title: string } {
  const title = data.name ? `${data.name} — ScholarFolio` : DEFAULT_TITLE;

  let description = DEFAULT_DESCRIPTION;
  if (data.name) {
    const parts: string[] = [];
    if (data.affiliation) parts.push(data.affiliation);
    if (data.totalCitations != null) parts.push(`${data.totalCitations} citations`);
    if (data.hIndex != null) parts.push(`h-index ${data.hIndex}`);
    if (parts.length > 0) description = `${data.name}: ${parts.join(' · ')}. Citation trends, co-author network, and field-normalized metrics on ScholarFolio.`;
  }

  const image = data.imageUrl || DEFAULT_IMAGE;
  // Claimed profiles' canonical is their vanity slug (also what the sitemap
  // lists); unclaimed profiles canonicalize to /scholar/<id>.
  const url = claimedSlug
    ? `https://scholarfolio.org/${claimedSlug}`
    : `https://scholarfolio.org/scholar/${encodeURIComponent(userId)}`;

  // schema.org Person — structured data for search engines. JSON.stringify
  // handles escaping; "<" is additionally escaped so cached profile text can
  // never break out of the script element.
  let jsonLd = '';
  if (data.name) {
    const person: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.name,
      url,
      mainEntityOfPage: url,
    };
    if (data.affiliation) person.affiliation = { '@type': 'Organization', name: data.affiliation };
    if (!userId.startsWith('openalex:')) {
      person.sameAs = [`https://scholar.google.com/citations?user=${encodeURIComponent(userId)}`];
    }
    const payload = JSON.stringify(person).replace(/</g, '\\u003c');
    jsonLd = `\n    <script type="application/ld+json">${payload}</script>`;
  }

  const tags = `
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:url" content="${escapeAttr(url)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="ScholarFolio" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />${jsonLd}`;

  return { tags, title };
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectHead(html: string, tags: string, title: string): string {
  // Remove tags we replace: og:/twitter: metas, the static description, and
  // swap the <title> so search engines index a unique one per profile.
  const cleaned = html
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s+name="description"[^>]*\/?>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);

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

  // Fetch scholar data + claimed slug from Supabase (cache reads only)
  const [scholarData, claimedSlug] = await Promise.all([
    fetchScholarData(userId),
    fetchClaimedSlug(userId),
  ]);
  const { tags, title } = buildHead(scholarData || {}, userId, claimedSlug);
  const modifiedHtml = injectHead(html, tags, title);

  return new Response(modifiedHtml, {
    status: originalResponse.status,
    headers: {
      ...Object.fromEntries(originalResponse.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
