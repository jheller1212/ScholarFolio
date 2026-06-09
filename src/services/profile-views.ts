import { supabase } from '../lib/supabase';

export interface TrendingProfile {
  scholar_id: string;
  author_name: string | null;
  affiliation: string | null;
  view_count: number;
}

/** Fire-and-forget: track a profile view */
export function trackProfileView(scholarId: string, authorName: string, affiliation: string): void {
  supabase
    .from('profile_views')
    .insert({ scholar_id: scholarId, author_name: authorName, affiliation })
    .then(() => {})
    .catch(() => {});
}

/** Fetch trending profiles using server-side aggregation */
export async function fetchTrendingProfiles(days: number = 7, limit: number = 20): Promise<TrendingProfile[]> {
  const { data, error } = await supabase.rpc('trending_profiles', {
    days_ago: days,
    max_results: limit,
  });
  if (error || !data) return [];
  return data as TrendingProfile[];
}

/** Get total view count */
export async function fetchTotalViewCount(days: number = 0): Promise<number> {
  let query = supabase
    .from('profile_views')
    .select('id', { count: 'exact', head: true });

  if (days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('viewed_at', since);
  }

  const { count } = await query;
  return count ?? 0;
}
