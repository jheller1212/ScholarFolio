import { supabase } from '../lib/supabase';
import { oaFetchJson, OA_API_URL, OA_EMAIL } from './openalex/author-lookup';
import { canonicalNameKey } from '../utils/names';

/** Cache key for a co-author name. Uses the shared canonical form so the same
 *  researcher spelled "Müller", "Mueller" or with a Unicode hyphen resolves to
 *  one cache entry — a local lowercase-and-strip-dots version folded none of
 *  that and quietly split one person across several rows. */
function normalizeName(name: string): string {
  return canonicalNameKey(name);
}

export interface CoAuthorLink {
  scholar_id: string | null;
  openalex_id: string | null;
  orcid: string | null;
  s2_author_id: string | null;
  name: string;
}

/** Look up a cached co-author → Scholar mapping by name */
export async function lookupCoAuthorLink(name: string): Promise<CoAuthorLink | null> {
  const normalized = normalizeName(name);
  const { data } = await supabase
    .from('coauthor_links')
    .select('scholar_id, openalex_id, orcid, s2_author_id, name')
    .eq('name_normalized', normalized)
    .limit(1)
    .single();
  return data ?? null;
}

/** Save a verified co-author link (upsert by normalized name, merges fields).
 *  After saving, kicks off background enrichment for ORCID and S2 author ID. */
export async function saveCoAuthorLink(params: {
  name: string;
  scholarId?: string;
  scholarUrl?: string;
  openalexId?: string;
  orcid?: string;
  s2AuthorId?: string;
  institution?: string;
  contributedBy?: string;
}): Promise<void> {
  const normalized = normalizeName(params.name);

  // Check if exists
  const { data: existing } = await supabase
    .from('coauthor_links')
    .select('id, scholar_id, openalex_id, orcid, s2_author_id')
    .eq('name_normalized', normalized)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('coauthor_links')
      .update({
        ...(params.scholarId && { scholar_id: params.scholarId }),
        ...(params.scholarUrl && { scholar_url: params.scholarUrl }),
        ...(params.openalexId && { openalex_id: params.openalexId }),
        ...(params.orcid && { orcid: params.orcid }),
        ...(params.s2AuthorId && { s2_author_id: params.s2AuthorId }),
        ...(params.institution && { institution: params.institution }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    // Background-enrich missing IDs
    const openalexId = params.openalexId || existing.openalex_id;
    const needsOrcid = !params.orcid && !existing.orcid && !!openalexId;
    const needsS2 = !params.s2AuthorId && !existing.s2_author_id;
    if (needsOrcid || needsS2) {
      enrichCoAuthorLink(normalized, openalexId, needsOrcid, needsS2, params.name).catch(() => {});
    }
  } else {
    await supabase
      .from('coauthor_links')
      .insert({
        name: params.name,
        name_normalized: normalized,
        scholar_id: params.scholarId ?? null,
        scholar_url: params.scholarUrl ?? null,
        openalex_id: params.openalexId ?? null,
        orcid: params.orcid ?? null,
        s2_author_id: params.s2AuthorId ?? null,
        institution: params.institution ?? null,
        contributed_by: params.contributedBy ?? null,
      });

    // Background-enrich
    const needsOrcid = !params.orcid && !!params.openalexId;
    const needsS2 = !params.s2AuthorId;
    if (needsOrcid || needsS2) {
      enrichCoAuthorLink(normalized, params.openalexId, needsOrcid, needsS2, params.name).catch(() => {});
    }
  }
}

/** Background: fetch ORCID from OpenAlex and S2 author ID from Semantic Scholar */
async function enrichCoAuthorLink(
  nameNormalized: string,
  openalexId: string | null | undefined,
  fetchOrcid: boolean,
  fetchS2: boolean,
  displayName: string,
): Promise<void> {
  const updates: Record<string, string> = {};

  // Fetch ORCID from OpenAlex author record
  if (fetchOrcid && openalexId) {
    const shortId = openalexId.replace('https://openalex.org/', '');
    const data = await oaFetchJson<{ orcid?: string }>(
      `${OA_API_URL}/authors/${shortId}?select=orcid&mailto=${OA_EMAIL}`
    );
    if (data?.orcid) {
      updates.orcid = data.orcid;
    }
  }

  // Fetch S2 author ID by searching for the author's name
  if (fetchS2) {
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(displayName)}&limit=1`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data?.[0]?.authorId) {
          updates.s2_author_id = json.data[0].authorId;
        }
      }
    } catch { /* best effort */ }
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('coauthor_links')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('name_normalized', nameNormalized);
  }
}
