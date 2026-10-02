import { supabase } from '../../lib/supabase';

/**
 * OpenAlex sometimes splits one researcher across several author records (a
 * name variant, a move between institutions). public.author_aliases maps each
 * extra record to the person's canonical one, whose name and topics the merged
 * profile shows.
 *
 * Rows only ever come from evidence, never from name similarity — merging on a
 * similar name would eventually show someone a stranger's publications, which
 * is worse than a split profile. An admin adds one after checking, or the
 * claim-profile function adds one when OpenAlex ties the record to the
 * verified owner's ORCID.
 */

export interface AliasRow {
  alias_id: string;
  canonical_id: string;
}

let aliasesPromise: Promise<AliasRow[]> | null = null;

/** The whole alias table (tiny, public-read), fetched once per page load. A
 *  failed read yields no aliases — profiles just show unmerged — and is retried
 *  on the next call instead of being cached. */
export function loadAuthorAliases(): Promise<AliasRow[]> {
  if (!aliasesPromise) {
    aliasesPromise = (async () => {
      const { data, error } = await supabase.from('author_aliases').select('alias_id, canonical_id');
      if (error || !data) {
        aliasesPromise = null;
        return [];
      }
      return data as AliasRow[];
    })();
  }
  return aliasesPromise;
}

/** Every record of the person `shortId` belongs to, canonical first. */
export function groupFor(rows: readonly AliasRow[], shortId: string): string[] {
  const canonical = rows.find(r => r.alias_id === shortId)?.canonical_id ?? shortId;
  const aliases = rows.filter(r => r.canonical_id === canonical && r.alias_id !== canonical).map(r => r.alias_id);
  return [canonical, ...new Set(aliases)];
}

/** Every OpenAlex author id belonging to the same person as `shortId`, canonical first. */
export async function openAlexRecordsFor(shortId: string): Promise<string[]> {
  return groupFor(await loadAuthorAliases(), shortId);
}

/** Test hook: forget the cached table. */
export function resetAuthorAliasesCache(): void {
  aliasesPromise = null;
}
