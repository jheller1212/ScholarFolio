import type { Context } from '@netlify/edge-functions';
import { buildHead, injectHead, slugToName } from './head.ts';
import { resolveProfileTarget } from './routes.ts';
import { fetchClaimByAuthor, fetchClaimBySlug, fetchScholarData } from './supabase.ts';
import type { Claim, ScholarData } from './supabase.ts';

// Social preview bots AND search engines get a real title, canonical, meta
// description, and Person JSON-LD injected from the cache, so every profile
// URL (/scholar/<id> and vanity /<slug>) unfurls and indexes as a unique
// document instead of the empty SPA shell. Cache-only — never triggers a paid
// fetch. Humans pass straight through.
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

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

interface Resolved { authorId: string; claim: Claim | null; data: ScholarData | null }

async function resolve(url: URL): Promise<Resolved | null> {
  const target = resolveProfileTarget(url.pathname, url.searchParams);
  if (!target) return null;
  if (target.kind === 'id') {
    const [data, claim] = await Promise.all([fetchScholarData(target.id), fetchClaimByAuthor(target.id)]);
    return { authorId: target.id, claim, data };
  }
  const claim = await fetchClaimBySlug(target.slug);
  if (!claim) return null; // unknown slug — let the SPA show its not-found state
  return { authorId: claim.authorId, claim, data: await fetchScholarData(claim.authorId) };
}

export default async function handler(req: Request, context: Context): Promise<Response> {
  if (!isCrawler(req.headers.get('user-agent') || '')) return context.next();

  const resolved = await resolve(new URL(req.url));
  if (!resolved) return context.next();

  let originalResponse: Response;
  try {
    originalResponse = await context.next();
  } catch {
    return context.next();
  }

  const contentType = originalResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return originalResponse;

  let html: string;
  try {
    html = await originalResponse.text();
  } catch {
    return originalResponse;
  }

  const { authorId, claim, data } = resolved;
  const { tags, title } = buildHead({
    data: data || {},
    authorId,
    claimedSlug: claim?.slug ?? null,
    // Not cached yet: a claimed vanity link still deserves the owner's name
    // (stored display name, else the name-derived slug).
    fallbackName: claim ? claim.displayName?.trim() || slugToName(claim.slug) : null,
  });

  return new Response(injectHead(html, tags, title), {
    status: originalResponse.status,
    headers: {
      ...Object.fromEntries(originalResponse.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
