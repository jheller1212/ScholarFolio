import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * Owner self-service corrections. Only a user holding a verified (ORCID) claim
 * on the profile reaches this, and only descriptive fields are editable —
 * metrics are never overridable, so a correction can't inflate a number.
 *
 * Every value is validated here, not just in the browser: the override is shown
 * to every visitor of the profile.
 */

type Result = { status: number; body: Record<string, unknown> };

export const OWNER_FIELDS = ["affiliation", "display_name", "title", "pronouns", "hide_work"] as const;
type OwnerField = typeof OWNER_FIELDS[number];

const MAX_LEN: Record<Exclude<OwnerField, "pronouns">, number> = {
  affiliation: 300,
  display_name: 300,
  title: 120,
  hide_work: 500,
};
/** Upper bound on hidden papers per profile — a misattribution fix, not a curation tool. */
const MAX_HIDDEN_WORKS = 200;

/** Same normalisation the client uses to match a hidden title to a publication. */
export function workTitleKey(title: string): string {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Validate and normalise a value for `field`; returns an error string when invalid. */
export function validateOwnerValue(field: OwnerField, raw: unknown): { value: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Provide a value" };
  const text = raw.replace(/\s+/g, " ").trim();
  if (field === "pronouns") {
    const key = text.toLowerCase().split(/[\s/]+/)[0];
    return key === "they" || key === "she" || key === "he"
      ? { value: key }
      : { error: "Pronouns must be they/them, she/her or he/him" };
  }
  if (!text) return { error: "Provide a value" };
  if (text.length > MAX_LEN[field]) return { error: `Keep it under ${MAX_LEN[field]} characters` };
  if (field === "hide_work" && !workTitleKey(text)) return { error: "Provide the paper's title" };
  // Plain text only — the value is rendered on a public page.
  if (/[<>]/.test(text)) return { error: "Angle brackets are not allowed" };
  return { value: text };
}

function hiddenTitle(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { title?: unknown }).title === "string") {
    return (value as { title: string }).title;
  }
  return "";
}

export async function handleOwnerCorrection(
  supabase: SupabaseClient,
  userId: string,
  authorId: string,
  action: "correct" | "uncorrect",
  field: unknown,
  rawValue: unknown,
): Promise<Result> {
  const { data: claim } = await supabase
    .from("claimed_profiles").select("id")
    .eq("user_id", userId).eq("author_id", authorId).eq("verified", true)
    .maybeSingle();
  if (!claim) return { status: 403, body: { error: "You can only correct a profile you have verified as yours." } };

  if (typeof field !== "string" || !(OWNER_FIELDS as readonly string[]).includes(field)) {
    return { status: 400, body: { error: "Unsupported field" } };
  }
  const f = field as OwnerField;

  // Revert: scalar fields drop every active override for the field; hide_work
  // un-hides the one paper named in `value`.
  if (action === "uncorrect") {
    if (f !== "hide_work") {
      const { error } = await supabase.from("profile_overrides").update({ active: false })
        .eq("author_id", authorId).eq("field", f).eq("active", true);
      return error ? { status: 400, body: { error: error.message } } : { status: 200, body: { ok: true } };
    }
    const v = validateOwnerValue(f, rawValue);
    if ("error" in v) return { status: 400, body: { error: v.error } };
    const { data: rows } = await supabase.from("profile_overrides").select("id, value")
      .eq("author_id", authorId).eq("field", "hide_work").eq("active", true);
    const ids = (rows ?? [])
      .filter((r: { value: unknown }) => workTitleKey(hiddenTitle(r.value)) === workTitleKey(v.value))
      .map((r: { id: string }) => r.id);
    if (ids.length === 0) return { status: 200, body: { ok: true } };
    const { error } = await supabase.from("profile_overrides").update({ active: false }).in("id", ids);
    return error ? { status: 400, body: { error: error.message } } : { status: 200, body: { ok: true } };
  }

  const v = validateOwnerValue(f, rawValue);
  if ("error" in v) return { status: 400, body: { error: v.error } };

  if (f === "hide_work") {
    const { data: rows } = await supabase.from("profile_overrides").select("value")
      .eq("author_id", authorId).eq("field", "hide_work").eq("active", true);
    const existing = (rows ?? []).map((r: { value: unknown }) => workTitleKey(hiddenTitle(r.value)));
    if (existing.includes(workTitleKey(v.value))) return { status: 200, body: { ok: true } };
    if (existing.length >= MAX_HIDDEN_WORKS) {
      return { status: 400, body: { error: `You can hide at most ${MAX_HIDDEN_WORKS} papers. Contact us if more are wrong.` } };
    }
    const { error } = await supabase.from("profile_overrides").insert({
      author_id: authorId, field: f, value: { title: v.value }, verified_via: "orcid", created_by: userId, active: true,
    });
    return error ? { status: 400, body: { error: error.message } } : { status: 200, body: { ok: true } };
  }

  // One active value per scalar field: the owner's latest word replaces any
  // earlier correction, including an admin one.
  await supabase.from("profile_overrides").update({ active: false })
    .eq("author_id", authorId).eq("field", f).eq("active", true);
  const { error } = await supabase.from("profile_overrides").insert({
    author_id: authorId, field: f, value: v.value, verified_via: "orcid", created_by: userId, active: true,
  });
  return error ? { status: 400, body: { error: error.message } } : { status: 200, body: { ok: true } };
}
