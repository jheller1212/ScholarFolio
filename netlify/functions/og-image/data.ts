import type { CardInput } from './card.ts';

const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
// Publishable key — safe to embed, same as client-side
const SUPABASE_ANON_KEY = 'sb_publishable_oKej73idzSJ1eJqwmgF5WQ_m2rvKae5';

export interface CardSource {
  data: {
    name?: string;
    affiliation?: string;
    totalCitations?: number;
    hIndex?: number;
    metrics?: { i10Index?: number };
  } | null;
  claim: { slug: string; display_name: string | null } | null;
}

async function rest<T>(query: string): Promise<T[] | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`og-image: supabase ${res.status}`);
  return (await res.json()) as T[];
}

export async function fetchCardSource(authorId: string): Promise<CardSource | null> {
  const cacheKey = `https://scholar.google.com/citations?user=${encodeURIComponent(authorId)}`;
  const [dataRows, claimRows] = await Promise.all([
    rest<{ data: CardSource['data'] }>(`scholar_cache?url=eq.${encodeURIComponent(cacheKey)}&select=data&limit=1`),
    rest<NonNullable<CardSource['claim']>>(`claimed_profiles?author_id=eq.${encodeURIComponent(authorId)}&select=slug,display_name&limit=1`),
  ]);
  const data = dataRows?.[0]?.data ?? null;
  const claim = claimRows?.[0] ?? null;
  return data || claim ? { data, claim } : null;
}

// The bundled fonts cover Latin scripts only; a name in another script would
// render as blank boxes, so those profiles get the default card instead.
const LATIN_TEXT = /^[\u0000-ɏḀ-ỿ -⁯€]*$/;

export function cardInputFor(authorId: string, { data, claim }: CardSource): CardInput | null {
  const name = data?.name?.trim() || claim?.display_name?.trim();
  if (!name || !LATIN_TEXT.test(name)) return null; // the default card is better
  const affiliation = data?.affiliation?.trim();
  return {
    name,
    affiliation: affiliation && LATIN_TEXT.test(affiliation) ? affiliation : undefined,
    totalCitations: data?.totalCitations,
    hIndex: data?.hIndex,
    i10Index: data?.metrics?.i10Index,
    urlLabel: claim ? `scholarfolio.org/${claim.slug}` : `scholarfolio.org/scholar/${authorId}`,
  };
}
