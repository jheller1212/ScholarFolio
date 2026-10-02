import { supabase } from '../lib/supabase';

// Must match CACHE_DURATION in supabase/functions/scholar/index.ts. Rows written
// before created_at was reset on refresh only tell us the fetch time via
// expires_at minus this TTL.
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** When the cache entry was last written, from its expiry and the TTL. */
export function fetchedAtFromExpiry(expiresAt: string, now = new Date()): Date | null {
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return null;
  const fetched = new Date(expires - CACHE_TTL_MS);
  // Never claim a date in the future (clock skew, TTL changes).
  return fetched.getTime() > now.getTime() ? now : fetched;
}

/**
 * Best estimate of the fetch time: created_at is exact for rows written since it
 * is reset on refresh; for older rows it is the first insert, so take whichever
 * of the two signals is later.
 */
export function fetchedAtFromRow(row: { created_at?: string | null; expires_at?: string | null }, now = new Date()): Date | null {
  const fromExpiry = row.expires_at ? fetchedAtFromExpiry(row.expires_at, now) : null;
  const created = row.created_at ? new Date(row.created_at) : null;
  const fromCreated = created && !Number.isNaN(created.getTime()) && created.getTime() <= now.getTime() ? created : null;
  if (fromExpiry && fromCreated) return fromCreated > fromExpiry ? fromCreated : fromExpiry;
  return fromCreated ?? fromExpiry;
}

/**
 * When the Google Scholar data behind a profile was fetched. Returns null when
 * unknown (OpenAlex-only profiles, missing row, network error) so the UI can
 * simply leave the date out.
 */
export async function fetchProfileDataAsOf(scholarId: string): Promise<Date | null> {
  if (!scholarId) return null;
  try {
    const { data, error } = await supabase
      .from('scholar_cache')
      .select('created_at, expires_at')
      .eq('url', `https://scholar.google.com/citations?user=${scholarId}`)
      .maybeSingle();
    if (error || !data) return null;
    return fetchedAtFromRow(data);
  } catch {
    return null;
  }
}
