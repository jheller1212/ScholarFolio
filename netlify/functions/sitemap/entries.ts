// Sitemap entry assembly, kept pure so it can be unit-tested with vitest.

export const SITE = 'https://scholarfolio.org';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

export interface ClaimRow { slug: string; author_id: string; updated_at: string | null }
export interface CacheRow { url: string; created_at: string | null }

export const STATIC_PAGES: SitemapEntry[] = [
  { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE}/about`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${SITE}/institutions`, changefreq: 'monthly', priority: '0.5' },
  { loc: `${SITE}/trending`, changefreq: 'daily', priority: '0.6' },
  { loc: `${SITE}/changelog`, changefreq: 'weekly', priority: '0.5' },
  { loc: `${SITE}/privacy`, changefreq: 'monthly', priority: '0.3' },
  { loc: `${SITE}/terms`, changefreq: 'monthly', priority: '0.3' },
];

const SCHOLAR_URL_PREFIX = 'https://scholar.google.com/citations?user=';

function day(ts: string | null | undefined): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function latest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

// Claimed profiles are listed under their vanity slug (their canonical URL);
// every other cached Google Scholar profile under /scholar/<id>. lastmod is
// when the cached data was last refreshed, so crawlers revisit after updates.
export function profileEntries(claims: ClaimRow[], cache: CacheRow[]): SitemapEntry[] {
  const refreshed = new Map<string, string | undefined>();
  for (const row of cache) {
    if (!row.url.startsWith(SCHOLAR_URL_PREFIX)) continue;
    let id: string;
    try {
      id = decodeURIComponent(row.url.slice(SCHOLAR_URL_PREFIX.length));
    } catch {
      continue;
    }
    if (/^[\w-]{6,}$/.test(id)) refreshed.set(id, day(row.created_at));
  }

  const claimed = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const c of claims) {
    if (!c.slug) continue;
    claimed.add(c.author_id);
    entries.push({
      loc: `${SITE}/${c.slug}`,
      lastmod: latest(day(c.updated_at), refreshed.get(c.author_id)),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }
  for (const [id, lastmod] of refreshed) {
    if (claimed.has(id)) continue;
    entries.push({ loc: `${SITE}/scholar/${encodeURIComponent(id)}`, lastmod, changefreq: 'monthly', priority: '0.5' });
  }
  return entries;
}

// Static guide pages (stream-owned under public/guides/). Accepts the
// generated manifest shape ({ pages: [{ path, lastmod }] }) or a bare array of
// paths/objects, and ignores anything it doesn't understand.
export function guideEntries(manifest: unknown): SitemapEntry[] {
  const list = Array.isArray(manifest)
    ? manifest
    : (manifest && typeof manifest === 'object' && Array.isArray((manifest as { pages?: unknown }).pages))
      ? (manifest as { pages: unknown[] }).pages
      : [];
  const entries: SitemapEntry[] = [];
  for (const item of list) {
    const rawPath = typeof item === 'string'
      ? item
      : (item && typeof item === 'object' ? (item as { path?: unknown; url?: unknown }).path ?? (item as { url?: unknown }).url : undefined);
    if (typeof rawPath !== 'string' || !rawPath.startsWith('/guides')) continue;
    const lastmod = item && typeof item === 'object' ? day((item as { lastmod?: string }).lastmod) : undefined;
    entries.push({ loc: `${SITE}${rawPath}`, lastmod, changefreq: 'monthly', priority: '0.7' });
  }
  return entries;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function renderSitemap(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const urls = entries
    .filter((e) => (seen.has(e.loc) ? false : (seen.add(e.loc), true)))
    .map((e) => `  <url>
    <loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}
