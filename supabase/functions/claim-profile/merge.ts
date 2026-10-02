import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.39.3";

/**
 * "This other OpenAlex record is also me" — merging a split researcher.
 *
 * An owner's request is merged automatically (author_aliases, source 'orcid')
 * ONLY when OpenAlex itself ties the other record to the owner's verified
 * ORCID: either the record carries that ORCID, or one of its works lists that
 * ORCID on the authorship belonging to the record. Anything else becomes a
 * pending request (a profile_reports row, kind 'merge_request') that the admin
 * approves by hand. Never merge on name similarity: showing someone a
 * stranger's papers is worse than a split profile.
 */

type Result = { status: number; body: Record<string, unknown> };
type OaFetch = (path: string) => Promise<any | null>;

/** Works scanned for an ORCID-bearing authorship before giving up. */
const WORKS_SCANNED = 200;

export const OA_ID = /^A\d+$/;

function bareOa(id: unknown): string {
  return String(id ?? "").replace("https://openalex.org/", "").trim();
}

function bareOrcid(raw: unknown): string {
  const m = String(raw ?? "").match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  return m ? m[1].toUpperCase() : "";
}

/** True when OpenAlex links `recordId` to `orcid` (record-level or on one of its authorships). */
async function recordCarriesOrcid(oaFetch: OaFetch, recordId: string, orcid: string): Promise<boolean> {
  const author = await oaFetch(`/authors/${recordId}?select=id,orcid`);
  if (bareOrcid(author?.orcid) === orcid) return true;
  const works = await oaFetch(
    `/works?filter=authorships.author.id:${recordId}&select=id,authorships&per_page=${WORKS_SCANNED}`,
  );
  for (const w of works?.results ?? []) {
    for (const a of w.authorships ?? []) {
      if (bareOa(a?.author?.id) === recordId && bareOrcid(a?.author?.orcid) === orcid) return true;
    }
  }
  return false;
}

/** Follow an existing alias so merges always point at the final canonical record. */
async function resolveCanonical(supabase: SupabaseClient, id: string): Promise<string> {
  const { data } = await supabase.from("author_aliases").select("canonical_id").eq("alias_id", id).maybeSingle();
  return data?.canonical_id ?? id;
}

/** Insert alias -> canonical and re-point anything that used alias as its canonical. */
async function insertAlias(
  supabase: SupabaseClient,
  aliasId: string,
  canonicalId: string,
  source: "orcid" | "admin",
  createdBy: string,
  orcid: string | null,
): Promise<string | null> {
  const { error } = await supabase.from("author_aliases").insert({
    alias_id: aliasId, canonical_id: canonicalId, source, orcid, created_by: createdBy,
  });
  if (error) return error.message;
  await supabase.from("author_aliases").update({ canonical_id: canonicalId }).eq("canonical_id", aliasId);
  return null;
}

export async function proposeMerge(
  supabase: SupabaseClient,
  oaFetch: OaFetch,
  user: User,
  userOrcid: string,
  rawOtherId: unknown,
): Promise<Result> {
  const otherId = bareOa(rawOtherId);
  if (!OA_ID.test(otherId)) return { status: 400, body: { error: "Enter an OpenAlex author id like A5012345678." } };

  const { data: claim } = await supabase
    .from("claimed_profiles").select("author_id, display_name")
    .eq("user_id", user.id).eq("verified", true).maybeSingle();
  if (!claim) return { status: 403, body: { error: "Verify your profile with ORCID first." } };

  // The owner's own record is whichever OpenAlex record holds their ORCID.
  const own = await oaFetch(`/authors/orcid:${userOrcid}?select=id`);
  const ownId = bareOa(own?.id);
  const canonical = OA_ID.test(ownId) ? await resolveCanonical(supabase, ownId) : null;

  if (canonical && (otherId === canonical || otherId === ownId)) {
    return { status: 400, body: { error: "That is already your main OpenAlex record." } };
  }

  const { data: existing } = await supabase
    .from("author_aliases").select("canonical_id").eq("alias_id", otherId).maybeSingle();
  if (existing && canonical && existing.canonical_id === canonical) {
    return { status: 200, body: { ok: true, merged: true, already: true } };
  }

  const evidence = canonical && !existing ? await recordCarriesOrcid(oaFetch, otherId, userOrcid) : false;
  if (evidence && canonical) {
    const err = await insertAlias(supabase, otherId, canonical, "orcid", user.id, `https://orcid.org/${userOrcid}`);
    if (err) return { status: 400, body: { error: err } };
    return { status: 200, body: { ok: true, merged: true } };
  }

  // No ORCID evidence (or the record is already merged elsewhere): queue for review.
  const { data: pending } = await supabase
    .from("profile_reports").select("id, payload")
    .eq("kind", "merge_request").eq("user_id", user.id).eq("resolved", false);
  const duplicate = (pending ?? []).some((r: { payload: { alias_id?: string } | null }) => r.payload?.alias_id === otherId);
  if (!duplicate) {
    const { error } = await supabase.from("profile_reports").insert({
      author_id: claim.author_id,
      author_name: claim.display_name,
      reporter_email: user.email ?? null,
      user_id: user.id,
      kind: "merge_request",
      payload: { alias_id: otherId, canonical_id: canonical, orcid: userOrcid, conflict: existing?.canonical_id ?? null },
      message: `Merge request: OpenAlex ${otherId} is also me (my ORCID record: ${canonical ?? "not found in OpenAlex"}). No ORCID link found on that record.`,
      credits_granted: 0,
    });
    if (error) return { status: 400, body: { error: error.message } };
  }
  return { status: 200, body: { ok: true, merged: false, pending: true } };
}

/** Admin approval of a pending request: inserts the alias with source 'admin'. */
export async function approveMerge(
  supabase: SupabaseClient,
  admin: User,
  reportId: unknown,
  rawAlias: unknown,
  rawCanonical: unknown,
): Promise<Result> {
  const aliasId = bareOa(rawAlias);
  const canonicalInput = bareOa(rawCanonical);
  if (!OA_ID.test(aliasId) || !OA_ID.test(canonicalInput)) return { status: 400, body: { error: "Both ids must look like A123…" } };
  const canonical = await resolveCanonical(supabase, canonicalInput);
  if (aliasId === canonical) return { status: 400, body: { error: "Alias and canonical are the same record." } };

  const { data: existing } = await supabase.from("author_aliases").select("canonical_id").eq("alias_id", aliasId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("author_aliases")
      .update({ canonical_id: canonical, source: "admin", created_by: admin.id }).eq("alias_id", aliasId);
    if (error) return { status: 400, body: { error: error.message } };
  } else {
    const err = await insertAlias(supabase, aliasId, canonical, "admin", admin.id, null);
    if (err) return { status: 400, body: { error: err } };
  }

  if (typeof reportId === "string" && reportId) {
    await supabase.from("profile_reports")
      .update({ resolved: true, resolved_note: `Merged ${aliasId} into ${canonical}` }).eq("id", reportId);
  }
  return { status: 200, body: { ok: true, aliasId, canonicalId: canonical } };
}
