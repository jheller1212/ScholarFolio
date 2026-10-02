import { supabase } from '../../lib/supabase';

/** Fields a verified owner can correct themselves (validated again server-side). */
export type OwnerField = 'affiliation' | 'display_name' | 'title' | 'pronouns' | 'hide_work';

/**
 * Write (or revert) one owner correction through the claim-profile function,
 * which re-checks the verified ORCID claim before touching profile_overrides.
 * Throws with the server's message so the form can show it.
 */
export async function submitOwnerCorrection(
  authorId: string,
  field: OwnerField,
  value: string,
  revert = false,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ action: revert ? 'uncorrect' : 'correct', authorId, field, value }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || 'Could not save your correction.');
}
