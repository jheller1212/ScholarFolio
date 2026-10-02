import { supabase } from '../../lib/supabase';

/** Fields a verified owner can correct themselves (validated again server-side). */
export type OwnerField = 'affiliation' | 'display_name' | 'title' | 'pronouns' | 'hide_work';

/** POST to claim-profile as the signed-in user; throws with the server's message. */
async function callClaimProfile(payload: Record<string, unknown>, fallbackError: string): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(typeof body.error === 'string' ? body.error : fallbackError);
  return body;
}

/**
 * Write (or revert) one owner correction. claim-profile re-checks the verified
 * ORCID claim before touching profile_overrides.
 */
export async function submitOwnerCorrection(
  authorId: string,
  field: OwnerField,
  value: string,
  revert = false,
): Promise<void> {
  await callClaimProfile({ action: revert ? 'uncorrect' : 'correct', authorId, field, value }, 'Could not save your correction.');
}

export interface MergeOutcome {
  merged: boolean;
  pending?: boolean;
  already?: boolean;
}

/**
 * Ask to merge another OpenAlex record into the owner's own. The server merges
 * at once only when OpenAlex links that record to the owner's verified ORCID;
 * otherwise it files a request for manual review.
 */
export async function proposeRecordMerge(otherId: string): Promise<MergeOutcome> {
  const body = await callClaimProfile({ action: 'propose-merge', otherId }, 'Could not send your request.');
  return { merged: Boolean(body.merged), pending: Boolean(body.pending), already: Boolean(body.already) };
}

/** Admin: approve a pending merge request (inserts an alias with source 'admin'). */
export async function approveRecordMerge(reportId: string, aliasId: string, canonicalId: string): Promise<void> {
  await callClaimProfile({ action: 'approve-merge', reportId, aliasId, canonicalId }, 'Could not merge.');
}
