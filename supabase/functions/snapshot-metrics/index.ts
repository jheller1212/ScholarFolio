import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * Monthly metric snapshot. For every ORCID-verified claimed profile it reads
 * the author's current metrics from OpenAlex (free, exact via ORCID) and writes
 * one row per calendar month into metric_snapshots. That history is what the
 * "your citations changed this month" digest diffs against.
 *
 * Verified-only for now: an ORCID resolves to exactly one OpenAlex author, so
 * the numbers are trustworthy. Emailing someone a wrong citation count would be
 * worse than sending nothing (accuracy principle).
 *
 * Auth: the caller must present the service-role key as a bearer token, so only
 * the scheduled GitHub Action (which holds it as a secret) can trigger it.
 * Deploy with: supabase functions deploy snapshot-metrics --no-verify-jwt
 */

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE_KEY);
const OA_MAILTO = "info@scholarfolio.org";

interface ClaimedProfile { author_id: string; orcid: string | null }

function normalizeOrcid(orcid: string): string {
  // Stored as a full URL; OpenAlex wants the bare or URL form consistently.
  return orcid.replace(/^https?:\/\/orcid\.org\//, "").trim();
}

Deno.serve(async (req) => {
  // Only a caller holding the service-role key may run this.
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profiles, error } = await supabase
    .from("claimed_profiles")
    .select("author_id, orcid")
    .eq("verified", true)
    .not("orcid", "is", null);

  if (error) {
    console.error("snapshot-metrics: profile query failed:", error);
    return new Response(JSON.stringify({ error: "Query failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const month = new Date();
  const capturedMonth = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`;

  let captured = 0;
  const failures: string[] = [];

  for (const p of (profiles ?? []) as ClaimedProfile[]) {
    if (!p.orcid) continue;
    const orcid = normalizeOrcid(p.orcid);
    try {
      const res = await fetch(
        `https://api.openalex.org/authors/https://orcid.org/${orcid}?mailto=${OA_MAILTO}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) { failures.push(`${p.author_id}:HTTP${res.status}`); continue; }
      const a = await res.json();
      const ss = a.summary_stats ?? {};
      const { error: upErr } = await supabase.from("metric_snapshots").upsert({
        author_id: p.author_id,
        openalex_author_id: (a.id ?? "").replace("https://openalex.org/", "") || null,
        captured_month: capturedMonth,
        cited_by_count: a.cited_by_count ?? null,
        works_count: a.works_count ?? null,
        h_index: ss.h_index ?? null,
        i10_index: ss.i10_index ?? null,
        source: "openalex",
      }, { onConflict: "author_id,captured_month" });
      if (upErr) { failures.push(`${p.author_id}:${upErr.code}`); continue; }
      captured++;
    } catch (e) {
      failures.push(`${p.author_id}:${e instanceof Error ? e.message : "err"}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, month: capturedMonth, captured, failures }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
