import type { Author } from '../../types/scholar';
import { supabase } from '../../lib/supabase';

/**
 * Verified profile corrections.
 *
 * Researchers report errors on their public profiles (wrong affiliation, stale
 * title, a misattributed paper). Admin-reviewed corrections are stored as
 * field-level overrides in `profile_overrides` and applied here, on top of the
 * source-derived profile, every time it's assembled — so a correction persists
 * across the source cache refreshing and is seen by every viewer.
 *
 * Scope is deliberately narrow: only descriptive, source-underivable fields.
 * Computed metrics (h-index, counts, co-author stats) are NEVER overridable —
 * they stay source-derived, so the correction layer can't be used to inflate a
 * number. Reads go through the `get_profile_overrides` SECURITY DEFINER function
 * so the browser (anon key) never touches the locked overrides table directly.
 */

export interface ProfileOverride {
  field: 'affiliation' | 'display_name' | 'title' | 'hide_work' | string;
  value: unknown;
  note: string | null;
  verified_via: 'admin' | 'orcid' | string;
}

/** Fetch active corrections for one author id (Scholar id or `openalex:<id>`). */
export async function fetchProfileOverrides(authorId: string): Promise<ProfileOverride[]> {
  if (!authorId) return [];
  const { data, error } = await supabase.rpc('get_profile_overrides', { p_author_id: authorId });
  if (error || !data) return [];
  return data as ProfileOverride[];
}

/** Coerce a jsonb override value to a display string (stored either as a bare
 *  JSON string or an object like `{ "text": "…" }`). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in value) {
    const t = (value as { text?: unknown }).text;
    return typeof t === 'string' ? t.trim() : '';
  }
  return '';
}

/**
 * Apply verified corrections to a profile. Phase 1 handles the descriptive
 * string fields (affiliation, display name); metric-affecting corrections such
 * as `hide_work` are applied earlier in the pipeline (before metrics are
 * computed) and are ignored here. Returns the input unchanged when there are no
 * overrides, so this is a no-op for the overwhelming majority of profiles.
 */
export function applyProfileOverrides(profile: Author, overrides: ProfileOverride[]): Author {
  if (!overrides || overrides.length === 0) return profile;

  let next = profile;
  const applied: Author['corrections'] = [];
  for (const o of overrides) {
    const text = asText(o.value);
    if (!text) continue;
    if (o.field === 'affiliation') next = { ...next, affiliation: text };
    else if (o.field === 'display_name') next = { ...next, name: text };
    else continue; // unhandled field (e.g. hide_work, applied elsewhere) — no marker
    applied.push({ field: o.field, note: o.note, verifiedVia: o.verified_via });
  }
  return applied.length > 0 ? { ...next, corrections: applied } : next;
}
