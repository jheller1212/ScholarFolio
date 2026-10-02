// Which profile (if any) a request path refers to. Kept free of Netlify/Deno
// APIs so it can be unit-tested with vitest.

export type ProfileTarget =
  | { kind: 'id'; id: string }
  | { kind: 'slug'; slug: string };

// Same shape the SPA accepts as a vanity slug (src/App.tsx); anything else can
// never be a profile, so the edge function falls through without a lookup.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// App routes and static prefixes that match SLUG_RE but are not profiles. The
// SPA resolves these before the slug lookup, so a claimed slug can't shadow
// them; skipping them here saves a Supabase round-trip per crawl.
export const RESERVED_PATHS = new Set([
  'about', 'terms', 'privacy', 'changelog', 'trending', 'unsubscribe', 'admin',
  'scholar', 'guides', 'api', 'badge', 'assets', 'fonts', 'sitemap', 'robots',
  'favicon', 'logo', 'og-default', 'og-image', 'netlify',
]);

export function resolveProfileTarget(pathname: string, search: URLSearchParams): ProfileTarget | null {
  // Legacy query form (?user=<id>) still present in previously shared links.
  const userParam = search.get('user');
  if (pathname === '/' && userParam) return { kind: 'id', id: userParam };

  const scholarMatch = pathname.match(/^\/scholar\/([^/]+)\/?$/);
  if (scholarMatch) {
    try {
      return { kind: 'id', id: decodeURIComponent(scholarMatch[1]) };
    } catch {
      return null; // malformed percent-encoding — serve the plain shell
    }
  }

  const slug = pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!SLUG_RE.test(slug) || RESERVED_PATHS.has(slug)) return null;
  return { kind: 'slug', slug };
}
