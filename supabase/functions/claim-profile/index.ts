import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * ORCID-verified profile claiming.
 *
 * Replaces the previous unverified claim path (any logged-in user could claim
 * any profile). To claim a profile a signed-in user must prove, via their linked
 * ORCID iD, that the profile is theirs:
 *   - OpenAlex profiles carry an ORCID directly → compare to the user's ORCID.
 *   - Google Scholar profiles have no ORCID → resolve the user's ORCID to its
 *     OpenAlex author record and require the display name to match the profile.
 * Profiles that cannot be matched this way are NOT self-claimable here; they fall
 * back to admin review (unchanged). Only users with an account + a linked ORCID
 * can reach this path.
 *
 * Deploy with: supabase functions deploy claim-profile --no-verify-jwt
 */

const OPENALEX_BASE = "https://api.openalex.org";
const OA_MAILTO = "info@scholarfolio.org";

const ALLOWED_ORIGINS = [
  "https://scholarfolio.org",
  "https://www.scholarfolio.org",
  "https://scholarfolio.netlify.app",
  "http://localhost:5173",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--scholarfolio\.netlify\.app$/.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// OpenAlex API key: env secret first, then the RLS-locked app_config table
// (same resolution as the scholar function).
let _oaKeyCache: string | null = null;
async function getOpenAlexKey(): Promise<string> {
  const envKey = Deno.env.get("OPENALEX_API_KEY");
  if (envKey) return envKey;
  if (_oaKeyCache !== null) return _oaKeyCache;
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", "openalex_api_key").maybeSingle();
    _oaKeyCache = data?.value ?? "";
  } catch {
    _oaKeyCache = "";
  }
  return _oaKeyCache;
}

async function oaFetch(path: string): Promise<any | null> {
  const key = await getOpenAlexKey();
  const url = new URL(OPENALEX_BASE + path);
  if (key) url.searchParams.set("api_key", key);
  else url.searchParams.set("mailto", OA_MAILTO);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  return await res.json();
}

/** Extract the bare 16-digit ORCID (0000-0000-0000-0000) from any ORCID form. */
function normalizeOrcid(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = String(raw).match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  return m ? m[1].toUpperCase() : "";
}

/** Loose person-name match (last name equal, first initials compatible). */
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,]/g, "").trim().split(/\s+/).filter(Boolean);
  const an = norm(a), bn = norm(b);
  if (an.length === 0 || bn.length === 0) return false;
  if (an[an.length - 1] !== bn[bn.length - 1]) return false; // last names must match
  return an[0][0] === bn[0][0]; // first initials must match
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // Authenticate — an account is required.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Sign in to claim a profile." }, 401);

    const userOrcid = normalizeOrcid(user.user_metadata?.orcid_id);
    if (!userOrcid) {
      return json({ verified: false, reason: "no-orcid", message: "Connect your ORCID iD to claim your profile." });
    }

    const body = await req.json();
    const { action, authorId, profileName, slug } = body as {
      action?: string; authorId?: string; profileName?: string; slug?: string;
    };
    if (!authorId) return json({ error: "authorId is required" }, 400);

    // --- Verify ownership via ORCID -------------------------------------------
    let verified = false;
    if (authorId.startsWith("openalex:")) {
      const shortId = authorId.replace("openalex:", "").replace("https://openalex.org/", "").trim();
      if (!/^A\d+$/.test(shortId)) return json({ error: "Invalid OpenAlex id" }, 400);
      const author = await oaFetch(`/authors/${shortId}?select=orcid`);
      verified = normalizeOrcid(author?.orcid) === userOrcid;
    } else {
      // Google Scholar profile: resolve the user's ORCID to its OpenAlex author
      // and require the display name to match the claimed profile.
      if (!profileName) return json({ error: "profileName is required for this profile" }, 400);
      const found = await oaFetch(`/authors?filter=orcid:${userOrcid}&select=display_name&per_page=1`);
      const oaName = found?.results?.[0]?.display_name;
      verified = !!oaName && namesMatch(oaName, profileName);
    }

    if (action === "verify") {
      return json({ verified });
    }

    if (action === "claim") {
      if (!verified) {
        return json({ verified: false, reason: "not-owner", message: "We couldn't verify that this profile belongs to your ORCID iD." });
      }
      // Enforce one claim per account and unique slug at the app layer already;
      // here we upsert a verified claim owned by this user.
      const row: Record<string, unknown> = {
        user_id: user.id,
        author_id: authorId,
        verified: true,
        orcid: `https://orcid.org/${userOrcid}`,
        verified_via: "orcid",
      };
      if (slug) row.slug = slug;
      const { error: upErr } = await supabase.from("claimed_profiles").upsert(row, { onConflict: "user_id" });
      if (upErr) return json({ error: upErr.message }, 400);
      return json({ verified: true, claimed: true });
    }

    return json({ error: 'Invalid action. Use "verify" or "claim".' }, 400);
  } catch (e) {
    console.error("claim-profile error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
