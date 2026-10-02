import { supabase } from '../lib/supabase';

// Must match CACHE_DURATION in supabase/functions/scholar/index.ts. The cache
// row only stores expires_at, so the fetch time is expires_at minus this.
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
 * When the Google Scholar data behind a profile was fetched. Returns null when
 * unknown (OpenAlex-only profiles, missing row, network error) so the UI can
 * simply leave the date out.
 */
export async function fetchProfileDataAsOf(scholarId: string): Promise<Date | null> {
  if (!scholarId) return null;
  try {
    const { data, error } = await supabase
      .from('scholar_cache')
      .select('expires_at')
      .eq('url', `https://scholar.google.com/citations?user=${scholarId}`)
      .maybeSingle();
    if (error || !data?.expires_at) return null;
    return fetchedAtFromExpiry(data.expires_at);
  } catch {
    return null;
  }
}
