import type { Author } from '../../types/scholar';
import { supabase } from '../../lib/supabase';
import { toPronounChoice } from '../../utils/pronouns';

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
  field: 'affiliation' | 'display_name' | 'title' | 'pronouns' | 'hide_work' | string;
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

/** Normalised title used to match a hidden-paper override to a publication.
 *  Mirrors workTitleKey in the claim-profile function, which validates writes. */
export function workTitleKey(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** hide_work values are stored as `{ "title": "…" }` (or a bare string). */
function hiddenTitle(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'title' in value) {
    const t = (value as { title?: unknown }).title;
    return typeof t === 'string' ? t.trim() : '';
  }
  return '';
}

/** Titles of the papers hidden from this profile (by its owner or an admin). */
export function hiddenWorkTitles(overrides: ProfileOverride[]): string[] {
  return overrides.filter(o => o.field === 'hide_work').map(o => hiddenTitle(o.value)).filter(Boolean);
}

/**
 * Apply verified corrections to a profile: descriptive strings (affiliation,
 * display name, title, pronouns) and hidden papers. Hiding removes a
 * misattributed paper from the publication list and from everything computed
 * from that list afterwards; Google Scholar's own headline totals stay as GS
 * reports them (the owner fixes those on Scholar itself). Returns the input
 * unchanged when there are no overrides, so this is a no-op for the
 * overwhelming majority of profiles.
 */
export function applyProfileOverrides(profile: Author, overrides: ProfileOverride[]): Author {
  if (!overrides || overrides.length === 0) return profile;

  let next = profile;
  const applied: Author['corrections'] = [];

  const hidden = new Set(hiddenWorkTitles(overrides).map(workTitleKey));
  if (hidden.size > 0) {
    const kept = next.publications.filter(p => !hidden.has(workTitleKey(p.title)));
    if (kept.length < next.publications.length) {
      const first = overrides.find(o => o.field === 'hide_work');
      next = { ...next, publications: kept };
      applied.push({ field: 'hide_work', note: null, verifiedVia: first?.verified_via ?? 'orcid' });
    }
  }

  for (const o of overrides) {
    const text = asText(o.value);
    if (!text) continue;
    if (o.field === 'affiliation') next = { ...next, affiliation: text };
    else if (o.field === 'display_name') next = { ...next, name: text };
    else if (o.field === 'title') next = { ...next, title: text };
    else if (o.field === 'pronouns') {
      // Self-declared only. An unrecognised value is dropped rather than
      // applied, so a bad row can't garble the narrative.
      const choice = toPronounChoice(text);
      if (!choice) continue;
      next = { ...next, pronouns: choice };
    }
    else continue; // hide_work is applied above; unknown fields are ignored
    applied.push({ field: o.field, note: o.note, verifiedVia: o.verified_via });
  }
  return applied.length > 0 ? { ...next, corrections: applied } : next;
}
