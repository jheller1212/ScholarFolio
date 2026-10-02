import type { Context } from '@netlify/edge-functions';
import { buildBody, injectBody } from './body.ts';
import type { CoauthorLink } from './body.ts';
import { candidateProfiles, frequentCoauthorKeys, listsAuthor } from './coauthors.ts';
import { buildHead, canonicalUrl, injectHead, slugToName } from './head.ts';
import { resolveProfileTarget } from './routes.ts';
import {
  fetchAuthorStrings, fetchClaimByAuthor, fetchClaimBySlug, fetchProfileIndex, fetchScholarData,
} from './supabase.ts';
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

// Search engines also get the text summary + co-author links; link-preview
// bots only read <head>, so they skip the extra lookups and stay fast.
const SEARCH_AGENTS = ['googlebot', 'bingbot', 'duckduckbot', 'applebot', 'yandex', 'baiduspider'];

const MAX_COAUTHOR_CHECKS = 8;

function matchesAny(userAgent: string, agents: string[]): boolean {
  const ua = userAgent.toLowerCase();
  return agents.some((bot) => ua.includes(bot));
}

async function findCoauthorLinks(data: ScholarData, authorId: string): Promise<CoauthorLink[]> {
  if (!data.name || !data.publications?.length) return [];
  const keys = frequentCoauthorKeys(data.publications, data.name);
  if (!keys.length) return [];
  const candidates = candidateProfiles(keys, await fetchProfileIndex(), authorId).slice(0, MAX_COAUTHOR_CHECKS);
  const confirmed = await Promise.all(
    candidates.map(async (c) => (listsAuthor(await fetchAuthorStrings(c.id), data.name ?? '') ? c : null)),
  );
  return confirmed
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({ name: c.name, url: canonicalUrl(c.id, c.slug) }));
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
  const userAgent = req.headers.get('user-agent') || '';
  if (!matchesAny(userAgent, CRAWLER_AGENTS)) return context.next();

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
  const isSearch = matchesAny(userAgent, SEARCH_AGENTS);
  const coauthors = isSearch && data ? await findCoauthorLinks(data, authorId).catch(() => []) : [];
  const { tags, title } = buildHead({
    data: data || {},
    authorId,
    claimedSlug: claim?.slug ?? null,
    // Not cached yet: a claimed vanity link still deserves the owner's name
    // (stored display name, else the name-derived slug).
    fallbackName: claim ? claim.displayName?.trim() || slugToName(claim.slug) : null,
    colleagues: coauthors.map((c) => c.url),
  });
  const body = isSearch && data ? buildBody(data, authorId, coauthors) : '';

  return new Response(injectBody(injectHead(html, tags, title), body), {
    status: originalResponse.status,
    headers: {
      ...Object.fromEntries(originalResponse.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
