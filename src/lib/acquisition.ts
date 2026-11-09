/**
 * Pure helpers for acquisition analytics: classify where a session landed and
 * where it came from. Shared by the admin Acquisition panel and the in-app
 * page_view tracker so both bucket paths identically.
 */

export type PageType = 'home' | 'profile' | 'vanity' | 'guide' | 'institutions' | 'trending' | 'other';

// Top-level app routes that are not vanity slugs (see PAGE_ROUTES in App.tsx).
const RESERVED_PATHS = new Set([
  'about', 'institutions', 'terms', 'privacy', 'changelog', 'trending', 'unsubscribe', 'admin',
  'scholar', 'guides', 'badge', 'api',
]);

// Same shape the app accepts as a vanity slug in App.tsx.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Classify a path (optionally with query string) into a coarse page type. */
export function classifyPageType(pathWithQuery: string): PageType {
  const [rawPath, query = ''] = pathWithQuery.split('?');
  const path = rawPath.replace(/\/+$/, '').toLowerCase() || '/';
  const params = new URLSearchParams(query);

  if (path === '/guides' || path.startsWith('/guides/')) return 'guide';
  if (path.startsWith('/scholar/')) return 'profile';
  if (path === '/') {
    if (params.get('user')) return 'profile';
    const page = params.get('page');
    if (page === 'institutions') return 'institutions';
    if (page === 'trending') return 'trending';
    return page ? 'other' : 'home';
  }
  const first = path.slice(1);
  if (first === 'institutions') return 'institutions';
  if (first === 'trending') return 'trending';
  if (!first.includes('/') && !RESERVED_PATHS.has(first) && SLUG_RE.test(first)) return 'vanity';
  return 'other';
}

/** Reduce a referrer URL to a host ("direct" when absent, "internal" for our own site). */
export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer || referrer === 'direct') return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return 'direct';
    if (host === 'scholarfolio.org' || host.endsWith('--scholarfolio.netlify.app') || host === 'localhost') return 'internal';
    return host;
  } catch {
    return 'unknown';
  }
}

export interface AnalyticsRow {
  event: string;
  pathname: string | null;
  properties: Record<string, unknown> | null;
  referrer: string | null;
  session_id: string | null;
  created_at: string;
}

export interface Landing {
  sessionId: string;
  pageType: PageType;
  referrerHost: string;
  utmSource: string;
  utmCampaign: string;
  createdAt: string;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** True for rows that mark the first page of a tab session. */
function isLandingRow(row: AnalyticsRow): boolean {
  if (row.event === 'visit') return true;
  return row.event === 'page_view' && row.properties?.landing === true;
}

/**
 * One landing per session: the earliest `visit` (app) or landing `page_view`
 * (static guides) row. A guide reader who clicks into the app logs both; the
 * guide came first, so that is where the session was acquired.
 */
export function landingsFrom(rows: AnalyticsRow[]): Landing[] {
  const bySession = new Map<string, AnalyticsRow>();
  for (const row of rows) {
    if (!row.session_id || !isLandingRow(row)) continue;
    const prev = bySession.get(row.session_id);
    if (!prev || row.created_at < prev.created_at) bySession.set(row.session_id, row);
  }
  return [...bySession.values()].map(row => {
    const p = row.properties ?? {};
    const landingPath = str(p.landing_page) ?? str(p.path) ?? row.pathname ?? '/';
    const pageType = (str(p.page_type) as PageType | null) ?? classifyPageType(landingPath);
    return {
      sessionId: row.session_id as string,
      pageType,
      referrerHost: referrerHost(str(p.referrer) ?? row.referrer),
      utmSource: str(p.utm_source) ?? '(none)',
      utmCampaign: str(p.utm_campaign) ?? '(none)',
      createdAt: row.created_at,
    };
  });
}

/** Count values and return them sorted descending. */
export function tally<T>(items: T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export const FUNNEL_STEPS = ['visit', 'search', 'profile_view', 'signup', 'claim_started', 'claim_completed'] as const;

/**
 * Distinct sessions reaching each funnel step. "visit" means any landing (so
 * guide-only sessions count). Steps are counted independently, not as a
 * strict sequence: a deep-link visitor can view a profile without searching.
 */
export function funnelCounts(rows: AnalyticsRow[], landings: Landing[]): Array<{ step: string; sessions: number }> {
  const sessions = new Map<string, Set<string>>();
  for (const step of FUNNEL_STEPS) sessions.set(step, new Set());
  for (const l of landings) sessions.get('visit')?.add(l.sessionId);
  for (const row of rows) {
    if (!row.session_id || row.event === 'visit') continue;
    sessions.get(row.event)?.add(row.session_id);
  }
  return FUNNEL_STEPS.map(step => ({ step, sessions: sessions.get(step)?.size ?? 0 }));
}
