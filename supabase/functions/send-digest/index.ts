import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { diffSnapshots, monthStart, type DigestDiff, type StoredSnapshot } from "../_shared/digest.ts";
import {
  SITE, buttonHtml, ensureUnsubToken, escapeHtml, firstName, getUserEmail, hasCronSecret,
  jsonResponse, layoutHtml, layoutText, maskEmail, sendEmail,
} from "../_shared/mailer.ts";

/**
 * Monthly citation digest — the email the sign-up wall promises ("Email me when
 * my citation metrics change"). Runs right after snapshot-metrics in the
 * monthly workflow and diffs this month's Google Scholar snapshot against the
 * previous one.
 *
 * Recipients: digest_opt_in = true AND a verified claimed profile. Skipped when
 * nothing changed, when there is no earlier snapshot to compare with, or when
 * this month's digest already went out (sent_emails kind 'digest').
 *
 * POST body:
 *   {}                         → send for the current month
 *   { "dryRun": true }         → return the would-send list, send nothing
 *   { "month": "2026-11-01" }  → diff a specific captured month (re-runs)
 *
 * Auth: CRON_SECRET bearer. Deploy with --no-verify-jwt.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const KIND = "digest";
const REASON = "You turned on the monthly citation digest.";

interface Claim { user_id: string; author_id: string; slug: string; display_name: string | null }

const fmt = (n: number) => n.toLocaleString("en-US");

function render(name: string | null, slug: string, d: DigestDiff, unsubToken: string | null) {
  const profileUrl = `${SITE}/${slug}`;
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
  const hLine = d.hIndexBefore !== null && d.hIndexAfter !== null && d.hIndexAfter !== d.hIndexBefore
    ? `h-index: ${d.hIndexBefore} → ${d.hIndexAfter}`
    : d.hIndexAfter !== null ? `h-index: ${d.hIndexAfter} (unchanged)` : null;
  const greet = firstName(name);

  const subject = d.citationsDelta > 0
    ? `+${fmt(d.citationsDelta)} citations this month`
    : `Your h-index is now ${d.hIndexAfter}`;

  const html = layoutHtml(`
  <p>${greet ? `Hi ${escapeHtml(greet)},` : "Hi,"}</p>
  <p>Here's what changed on your Google Scholar profile since last month:</p>
  <ul style="padding-left:18px">
    <li><b>+${fmt(d.citationsDelta)} citations</b> (${fmt(d.citationsTotal)} in total)</li>
    ${hLine ? `<li>${escapeHtml(hLine)}</li>` : ""}
    ${d.topPaper ? `<li>Most cited this month: <i>${escapeHtml(d.topPaper.title)}</i> (+${fmt(d.topPaper.gained)})</li>` : ""}
  </ul>
  ${buttonHtml(profileUrl, "See your profile")}
  <p style="font-size:14px">Proud of it? Your profile lives at <a href="${profileUrl}" style="color:#2d7d7d">scholarfolio.org/${escapeHtml(slug)}</a> — <a href="${shareUrl}" style="color:#2d7d7d">share it on LinkedIn</a> or add it to your email signature.</p>`,
    REASON, unsubToken);

  const text = layoutText(
    `${greet ? `Hi ${greet},` : "Hi,"}

Here's what changed on your Google Scholar profile since last month:

- +${fmt(d.citationsDelta)} citations (${fmt(d.citationsTotal)} in total)${hLine ? `\n- ${hLine}` : ""}${d.topPaper ? `\n- Most cited this month: ${d.topPaper.title} (+${fmt(d.topPaper.gained)})` : ""}

See your profile: ${profileUrl}
Proud of it? Share it: ${shareUrl}`,
    REASON, unsubToken);

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (!hasCronSecret(req)) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const month = typeof body.month === "string" && /^\d{4}-\d{2}-01$/.test(body.month)
    ? body.month
    : monthStart(new Date());

  const { data: prefs, error: prefErr } = await supabase
    .from("email_preferences").select("user_id, unsubscribe_token").eq("digest_opt_in", true);
  if (prefErr) return jsonResponse({ error: "preferences query failed" }, 500);
  const tokens = new Map((prefs ?? []).map((p: { user_id: string; unsubscribe_token: string }) => [p.user_id, p.unsubscribe_token]));
  if (tokens.size === 0) return jsonResponse({ ok: true, month, dryRun, subscribers: 0, sent: 0, wouldSend: [] });

  const { data: claims, error: claimErr } = await supabase
    .from("claimed_profiles").select("user_id, author_id, slug, display_name")
    .eq("verified", true).in("user_id", [...tokens.keys()]);
  if (claimErr) return jsonResponse({ error: "claims query failed" }, 500);

  const { data: already } = await supabase
    .from("sent_emails").select("user_id").eq("kind", KIND).gte("sent_at", month);
  const sentThisMonth = new Set((already ?? []).map((r: { user_id: string | null }) => r.user_id));

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1; };
  const wouldSend: Array<Record<string, unknown>> = [];
  const failures: string[] = [];
  let sent = 0;

  for (const c of (claims ?? []) as Claim[]) {
    if (sentThisMonth.has(c.user_id)) { skip("already-sent"); continue; }

    const { data: snaps } = await supabase
      .from("metric_snapshots")
      .select("captured_month, gs_citations, gs_h_index, gs_i10_index, gs_top_works, gs_source")
      .eq("author_id", c.author_id).lte("captured_month", month).not("gs_citations", "is", null)
      .order("captured_month", { ascending: false }).limit(2);
    const [curr, prev] = (snaps ?? []) as StoredSnapshot[];
    if (!curr || curr.captured_month !== month) { skip("no-snapshot-this-month"); continue; }
    if (!prev) { skip("no-earlier-snapshot"); continue; }
    const diff = diffSnapshots(prev, curr);
    if (!diff) { skip("no-change"); continue; }

    const email = await getUserEmail(supabase, c.user_id);
    if (!email) { skip("no-email"); continue; }

    const summary = {
      slug: c.slug, to: maskEmail(email), since: prev.captured_month,
      citationsDelta: diff.citationsDelta, hIndex: [diff.hIndexBefore, diff.hIndexAfter],
      topPaper: diff.topPaper?.title ?? null,
    };
    if (dryRun) { wouldSend.push(summary); continue; }

    const token = tokens.get(c.user_id) ?? await ensureUnsubToken(supabase, c.user_id);
    const { subject, html, text } = render(c.display_name, c.slug, diff, token);
    const r = await sendEmail(supabase, { to: email, subject, html, text, unsubToken: token, kind: KIND, userId: c.user_id });
    if (r.ok) { sent++; wouldSend.push(summary); } else failures.push(`${c.slug}:${r.error}`);
  }

  return jsonResponse({ ok: true, month, dryRun, subscribers: tokens.size, sent, wouldSend, skipped, failures });
});
