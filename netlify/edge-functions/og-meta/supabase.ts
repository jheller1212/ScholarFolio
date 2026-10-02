// Read-only cache lookups for crawler previews. Never triggers a paid fetch.

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const SUPABASE_ANON_KEY = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

export interface Publication {
  title?: string;
  year?: number | string;
  venue?: string;
  authors?: string[];
  citations?: number;
}

export interface ScholarData {
  name?: string;
  affiliation?: string;
  totalCitations?: number;
  hIndex?: number;
  imageUrl?: string;
  metrics?: { i10Index?: number };
  topics?: Array<{ name?: string }>;
  publications?: Publication[];
}

// A cached Google Scholar profile, for linking co-authors to their pages.
export interface IndexedProfile {
  id: string;
  name: string;
  slug: string | null;
}

export interface Claim {
  authorId: string;
  slug: string;
  displayName: string | null;
}

// Edge isolates are reused across requests, so a small in-memory TTL cache
// absorbs bursts (e.g. a LinkedIn post unfurled by many clients at once).
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;
const memo = new Map<string, { value: unknown; expires: number }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  if (memo.size >= MAX_ENTRIES) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

async function rest<T>(query: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

export function scholarCacheKey(id: string): string {
  return `https://scholar.google.com/citations?user=${encodeURIComponent(id)}`;
}

export function fetchScholarData(id: string): Promise<ScholarData | null> {
  return cached(`data:${id}`, async () => {
    const rows = await rest<{ data: ScholarData }>(
      `scholar_cache?url=eq.${encodeURIComponent(scholarCacheKey(id))}&select=data&limit=1`,
    );
    return rows?.[0]?.data ?? null;
  });
}

interface ClaimRow { author_id: string; slug: string; display_name: string | null }

function toClaim(row: ClaimRow | undefined): Claim | null {
  return row ? { authorId: row.author_id, slug: row.slug, displayName: row.display_name } : null;
}

export function fetchClaimBySlug(slug: string): Promise<Claim | null> {
  return cached(`slug:${slug}`, async () => {
    const rows = await rest<ClaimRow>(
      `claimed_profiles?slug=eq.${encodeURIComponent(slug)}&select=author_id,slug,display_name&limit=1`,
    );
    return toClaim(rows?.[0]);
  });
}

const SCHOLAR_PREFIX = 'https://scholar.google.com/citations?user=';

// Every cached Scholar profile's name (+ slug when claimed). Small (one row per
// cached profile, name only) and shared by all crawls via the memo.
export function fetchProfileIndex(): Promise<IndexedProfile[]> {
  return cached('profile-index', async () => {
    const [rows, claims] = await Promise.all([
      rest<{ url: string; name: string | null }>(
        `scholar_cache?select=url,name:data->>name&url=like.${encodeURIComponent(`${SCHOLAR_PREFIX}*`)}&limit=5000`,
      ),
      rest<{ author_id: string; slug: string }>('claimed_profiles?select=author_id,slug'),
    ]);
    const slugs = new Map((claims ?? []).map((c) => [c.author_id, c.slug]));
    const out: IndexedProfile[] = [];
    for (const row of rows ?? []) {
      if (!row.name) continue;
      let id: string;
      try {
        id = decodeURIComponent(row.url.slice(SCHOLAR_PREFIX.length));
      } catch {
        continue;
      }
      out.push({ id, name: row.name, slug: slugs.get(id) ?? null });
    }
    return out;
  });
}

// Author strings across one cached profile's publications, used to confirm a
// co-author match from the other side before linking.
export function fetchAuthorStrings(id: string): Promise<string[]> {
  return cached(`authors:${id}`, async () => {
    const rows = await rest<{ pubs: Publication[] | null }>(
      `scholar_cache?url=eq.${encodeURIComponent(scholarCacheKey(id))}&select=pubs:data->publications&limit=1`,
    );
    return (rows?.[0]?.pubs ?? []).flatMap((p) => p.authors ?? []);
  });
}

export function fetchClaimByAuthor(id: string): Promise<Claim | null> {
  return cached(`claim:${id}`, async () => {
    const rows = await rest<ClaimRow>(
      `claimed_profiles?author_id=eq.${encodeURIComponent(id)}&select=author_id,slug,display_name&limit=1`,
    );
    return toClaim(rows?.[0]);
  });
}
