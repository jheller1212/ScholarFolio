import { supabase } from '../lib/supabase';

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

interface CoAuthorLink {
  scholar_id: string | null;
  openalex_id: string | null;
  name: string;
}

/** Look up a cached co-author → Scholar mapping by name */
export async function lookupCoAuthorLink(name: string): Promise<CoAuthorLink | null> {
  const normalized = normalizeName(name);
  const { data } = await supabase
    .from('coauthor_links')
    .select('scholar_id, openalex_id, name')
    .eq('name_normalized', normalized)
    .limit(1)
    .single();
  return data ?? null;
}

/** Save a verified co-author → Scholar mapping (upsert by normalized name) */
export async function saveCoAuthorLink(params: {
  name: string;
  scholarId: string;
  scholarUrl?: string;
  openalexId?: string;
  institution?: string;
  contributedBy?: string;
}): Promise<void> {
  const normalized = normalizeName(params.name);

  // Check if exists
  const { data: existing } = await supabase
    .from('coauthor_links')
    .select('id')
    .eq('name_normalized', normalized)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('coauthor_links')
      .update({
        scholar_id: params.scholarId,
        scholar_url: params.scholarUrl ?? null,
        openalex_id: params.openalexId ?? null,
        institution: params.institution ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('coauthor_links')
      .insert({
        name: params.name,
        name_normalized: normalized,
        scholar_id: params.scholarId,
        scholar_url: params.scholarUrl ?? null,
        openalex_id: params.openalexId ?? null,
        institution: params.institution ?? null,
        contributed_by: params.contributedBy ?? null,
      });
  }
}
