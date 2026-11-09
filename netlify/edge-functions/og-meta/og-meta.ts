import type { Context } from '@netlify/edge-functions';
import { buildBody, injectBody } from './body.ts';
import type { CoauthorLink } from './body.ts';
import { candidateProfiles, frequentCoauthorKeys, listsAuthor } from './coauthors.ts';
import { buildHead, canonicalUrl, injectHead, markNoindex, slugToName } from './head.ts';
import { buildPageHead } from './pages.ts';
import { answerAgent, classifyRoute, wantsHead, wantsText } from './routes.ts';
import type { ProfileTarget } from './routes.ts';
import {
  fetchAuthorStrings, fetchClaimByAuthor, fetchClaimBySlug, fetchProfileIndex, fetchScholarData, logAgentFetch,
} from './supabase.ts';
import type { Claim, ScholarData } from './supabase.ts';

// Social preview bots, search engines and answer engines get a real title, canonical, meta
// description, and Person JSON-LD injected from the cache, so every profile
// URL (/scholar/<id> and vanity /<slug>) unfurls and indexes as a unique
// document instead of the empty SPA shell. Cache-only — never triggers a paid
// fetch. Humans pass straight through.
const MAX_COAUTHOR_CHECKS = 8;

async function findCoauthorLinks(data: ScholarData, authorId: string): Promise<CoauthorLink[]> {
  if (!data.name || !data.publications?.length) return [];
  const keys = frequentCoauthorKeys(data.publications, data.name);
  if (!keys.length) return [];
  const candidates = candidateProfiles(keys, await fetchProfileIndex(), authorId).slice(0, MAX_COAUTHOR_CHECKS);
  const confirmed = await Promise.all(
    candidates.map(async (c) => (listsAuthor(await fetchAuthorStrings(c.id).catch(() => []), data.name ?? '') ? c : null)),
  );
  return confirmed
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({ name: c.name, url: canonicalUrl(c.id, c.slug) }));
}

interface Resolved { authorId: string; claim: Claim | null; data: ScholarData | null }

// null = the slug is not claimed by anyone. Throws when Supabase can't be
// reached, so a lookup failure is never mistaken for "not found".
async function resolve(target: ProfileTarget): Promise<Resolved | null> {
  if (target.kind === 'id') {
    const [data, claim] = await Promise.all([fetchScholarData(target.id), fetchClaimByAuthor(target.id)]);
    return { authorId: target.id, claim, data };
  }
  const claim = await fetchClaimBySlug(target.slug);
  if (!claim) return null;
  return { authorId: claim.authorId, claim, data: await fetchScholarData(claim.authorId) };
}

// The SPA shell from the origin; html is null for anything that isn't HTML
// (or can't be read), which callers pass through untouched.
async function readHtml(context: Context): Promise<{ res: Response; html: string | null }> {
  const res = await context.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return { res, html: null };
  try {
    return { res, html: await res.text() };
  } catch {
    return { res, html: null };
  }
}

function htmlResponse(html: string, origin: Response, status: number, extra: Record<string, string>): Response {
  const inherited = Object.fromEntries(origin.headers.entries());
  delete inherited['content-length']; // the body was rewritten
  return new Response(html, {
    status,
    headers: {
      ...inherited,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      ...extra,
    },
  });
}

// Crawler sees nothing to index here. 404 when the URL can't be anything
// (unknown slug or path); noindex with 200 for an uncached /scholar/<id>,
// which a human visit would fetch live and render, so it isn't "gone".
async function excluded(context: Context, status: 404 | 200): Promise<Response> {
  const { res, html } = await readHtml(context);
  if (html === null) return res;
  return htmlResponse(markNoindex(html), res, status, { 'x-robots-tag': 'noindex, noai, noimageai' });
}

async function servePage(context: Context, page: string): Promise<Response> {
  const head = buildPageHead(page);
  if (!head) return context.next();
  const { res, html } = await readHtml(context);
  if (html === null) return res;
  // Humans get this too: keep the origin's revalidating cache policy, or a
  // browser could hold a shell that points at a previous deploy's bundles.
  const cacheControl = res.headers.get('cache-control') ?? 'public, max-age=0, must-revalidate';
  return htmlResponse(injectHead(html, head.tags, head.title), res, res.status, { 'cache-control': cacheControl });
}

export default async function handler(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  const route = classifyRoute(url.pathname, url.searchParams);
  const userAgent = req.headers.get('user-agent') || '';
  const agent = answerAgent(userAgent);
  if (agent && route.kind !== 'profile') await logAgentFetch(agent, url.pathname, false);

  // Content pages need no lookup, so everyone (not only crawlers) gets their
  // own title, canonical and share tags in the HTML itself.
  if (route.kind === 'page') return servePage(context, route.page);
  if (!wantsHead(userAgent)) return context.next();
  if (route.kind === 'unknown') return excluded(context, 404);
  if (route.kind !== 'profile') return context.next();

  let resolved: Resolved | null;
  try {
    resolved = await resolve(route.target);
  } catch {
    // Couldn't check: serve the plain shell rather than risk a false 404.
    if (agent) await logAgentFetch(agent, url.pathname, false);
    return context.next();
  }
  if (agent) await logAgentFetch(agent, url.pathname, !!resolved?.data);
  if (!resolved) return excluded(context, 404);
  if (!resolved.data && !resolved.claim) return excluded(context, 200);

  const { res, html } = await readHtml(context);
  if (html === null) return res;

  const { authorId, claim, data } = resolved;
  const isSearch = wantsText(userAgent);
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

  return htmlResponse(injectBody(injectHead(html, tags, title), body), res, res.status, {});
}
