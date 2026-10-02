import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { monthStart, parseCachedProfile, parseSerpAuthor, type GsSnapshot } from "../_shared/digest.ts";
import { hasCronSecret, jsonResponse } from "../_shared/mailer.ts";

/**
 * Monthly metric snapshot, one row per ORCID-verified claimed profile per
 * calendar month in metric_snapshots. That history is what send-digest diffs.
 *
 * Two sources per row:
 *  - OpenAlex (free, exact via the verified ORCID) — enrichment history.
 *  - Google Scholar headline numbers (citations, h-index, i10 + the most-cited
 *    works) — what the digest actually reports, since GS is the headline source.
 *    Only digest subscribers get a fresh SerpAPI call (one request each), so
 *    paid calls scale with opted-in owners, not with claims. Other profiles
 *    reuse scholar_cache when it is still fresh, which costs nothing.
 *
 * Verified-only: emailing someone a wrong citation count would be worse than
 * sending nothing (accuracy principle).
 *
 * Auth: CRON_SECRET bearer, held by the scheduled GitHub Action.
 * Deploy with: supabase functions deploy snapshot-metrics --no-verify-jwt
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") ?? "";
const OA_MAILTO = "info@scholarfolio.org";

interface ClaimedProfile { user_id: string; author_id: string; orcid: string | null }

function bareOrcid(orcid: string): string {
  return orcid.replace(/^https?:\/\/orcid\.org\//, "").trim();
}

async function openAlexColumns(orcid: string): Promise<Record<string, unknown> | string> {
  const res = await fetch(
    `https://api.openalex.org/authors/https://orcid.org/${bareOrcid(orcid)}?mailto=${OA_MAILTO}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) return `oa:HTTP${res.status}`;
  const a = await res.json();
  const ss = a.summary_stats ?? {};
  return {
    openalex_author_id: (a.id ?? "").replace("https://openalex.org/", "") || null,
    cited_by_count: a.cited_by_count ?? null,
    works_count: a.works_count ?? null,
    h_index: ss.h_index ?? null,
    i10_index: ss.i10_index ?? null,
    source: "openalex",
  };
}

/** One SerpAPI request: page one of the author's articles, which also carries
 *  GS's own citation/h-index/i10 table. */
async function fetchScholarHeadline(scholarId: string): Promise<GsSnapshot | string> {
  if (!SERPAPI_KEY) return "gs:no-serpapi-key";
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_scholar_author");
  url.searchParams.set("author_id", scholarId);
  url.searchParams.set("num", "100");
  url.searchParams.set("api_key", SERPAPI_KEY);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return `gs:HTTP${res.status}`;
  return parseSerpAuthor(await res.json()) ?? "gs:unparseable";
}

async function cachedScholarHeadline(scholarId: string): Promise<GsSnapshot | null> {
  const { data } = await supabase
    .from("scholar_cache")
    .select("data")
    .eq("url", `https://scholar.google.com/citations?user=${scholarId}`)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data ? parseCachedProfile(data.data) : null;
}

function gsColumns(s: GsSnapshot, source: "serpapi" | "cache"): Record<string, unknown> {
  return {
    gs_citations: s.citations,
    gs_h_index: s.hIndex,
    gs_i10_index: s.i10Index,
    gs_top_works: s.topWorks,
    gs_source: source,
    gs_fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (!hasCronSecret(req)) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: profiles, error } = await supabase
    .from("claimed_profiles")
    .select("user_id, author_id, orcid")
    .eq("verified", true);
  if (error) {
    console.error("snapshot-metrics: profile query failed:", error);
    return jsonResponse({ error: "Query failed" }, 500);
  }

  const { data: prefs } = await supabase.from("email_preferences").select("user_id").eq("digest_opt_in", true);
  const subscribers = new Set((prefs ?? []).map((p: { user_id: string }) => p.user_id));

  const capturedMonth = monthStart(new Date());
  let captured = 0, gsFresh = 0, gsCached = 0;
  const failures: string[] = [];

  for (const p of (profiles ?? []) as ClaimedProfile[]) {
    const row: Record<string, unknown> = { author_id: p.author_id, captured_month: capturedMonth };
    try {
      if (p.orcid) {
        const oa = await openAlexColumns(p.orcid);
        if (typeof oa === "string") failures.push(`${p.author_id}:${oa}`);
        else Object.assign(row, oa);
      }
      // Claims keyed on an OpenAlex record have no Scholar profile to read.
      if (!p.author_id.startsWith("openalex:")) {
        if (subscribers.has(p.user_id)) {
          const gs = await fetchScholarHeadline(p.author_id);
          if (typeof gs === "string") failures.push(`${p.author_id}:${gs}`);
          else { Object.assign(row, gsColumns(gs, "serpapi")); gsFresh++; }
        } else {
          const gs = await cachedScholarHeadline(p.author_id);
          if (gs) { Object.assign(row, gsColumns(gs, "cache")); gsCached++; }
        }
      }
      if (Object.keys(row).length === 2) continue; // nothing captured for this profile
      const { error: upErr } = await supabase
        .from("metric_snapshots")
        .upsert(row, { onConflict: "author_id,captured_month" });
      if (upErr) { failures.push(`${p.author_id}:${upErr.code}`); continue; }
      captured++;
    } catch (e) {
      failures.push(`${p.author_id}:${e instanceof Error ? e.message : "err"}`);
    }
  }

  return jsonResponse({ ok: true, month: capturedMonth, captured, gsFresh, gsCached, failures });
});
