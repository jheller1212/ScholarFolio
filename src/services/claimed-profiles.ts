import { supabase } from '../lib/supabase';

export type ClaimStatus = 'claimed' | 'verified';

// Google Scholar user ids are 12 url-safe characters. Only those can be claimed
// today, so OpenAlex candidates are never looked up.
const SCHOLAR_ID = /^[\w-]{12}$/;

export function claimableIds(authorIds: string[]): string[] {
  return [...new Set(authorIds.filter(id => SCHOLAR_ID.test(id)))];
}

export function toClaimStatusMap(rows: Array<{ author_id: string; verified: boolean | null }>): Map<string, ClaimStatus> {
  const map = new Map<string, ClaimStatus>();
  for (const row of rows) {
    map.set(row.author_id, row.verified ? 'verified' : 'claimed');
  }
  return map;
}

/**
 * Which of these search candidates already belong to a ScholarFolio user.
 * claimed_profiles is publicly readable (RLS "Anyone can view claimed profiles").
 * Best-effort: a failure just means no badges, never a broken search.
 */
export async function fetchClaimStatuses(authorIds: string[]): Promise<Map<string, ClaimStatus>> {
  const ids = claimableIds(authorIds);
  if (ids.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from('claimed_profiles')
      .select('author_id, verified')
      .in('author_id', ids);
    if (error || !data) return new Map();
    return toClaimStatusMap(data as Array<{ author_id: string; verified: boolean | null }>);
  } catch {
    return new Map();
  }
}
