import { supabase } from '../lib/supabase';

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,]/g, '');
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

/** Save a verified co-author link (upsert by normalized name, merges fields) */
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
    // Merge: only overwrite fields that are being provided (don't null out existing data)
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
  }
}
