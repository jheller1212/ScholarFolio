import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import {
  SITE, buttonHtml, ensureUnsubToken, escapeHtml, layoutHtml, layoutText, sendEmail,
} from "../_shared/mailer.ts";

/**
 * Admin: mark a profile report resolved and, when the reporter left an email,
 * tell them it's fixed — the other half of "so we can tell you when it's
 * fixed" on the report form. Sends at most once per report (notified_at) and
 * records the send in sent_emails (kind 'report_fixed').
 *
 * POST { reportId, note?, notify? (default true) } with the admin's JWT.
 * Deploy with: supabase functions deploy resolve-report --no-verify-jwt
 */

const ADMIN_EMAIL = "jonasheller89@gmail.com";
const ALLOWED_ORIGINS = [
  "https://scholarfolio.org",
  "https://www.scholarfolio.org",
  "https://scholarfolio.netlify.app",
  "http://localhost:5173",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+--scholarfolio\.netlify\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

interface Report {
  id: string;
  author_id: string;
  author_name: string | null;
  reporter_email: string | null;
  user_id: string | null;
  page_url: string | null;
  notified_at: string | null;
}

/** Link back to the profile — the reporter's own page URL only if it is ours. */
function profileLink(r: Report): string {
  if (r.page_url && /^https:\/\/(www\.)?scholarfolio\.org\//.test(r.page_url)) return r.page_url;
  return `${SITE}/?user=${encodeURIComponent(r.author_id)}`;
}

function render(r: Report, note: string | null, unsubToken: string | null) {
  const who = r.author_name ? ` for ${r.author_name}` : "";
  const link = profileLink(r);
  const reason = "You reported an error on a ScholarFolio profile and asked to hear back.";
  const subject = `Fixed: the profile error you reported${who}`;
  const html = layoutHtml(`
  <p>Hi,</p>
  <p>Thanks again for reporting a problem with the ScholarFolio profile${escapeHtml(who)}. It's been fixed.</p>
  ${note ? `<p><b>What changed:</b> ${escapeHtml(note)}</p>` : ""}
  ${buttonHtml(link, "See the profile")}
  <p style="font-size:14px">If something still looks wrong, just reply to this email.</p>`, reason, unsubToken);
  const text = layoutText(
    `Hi,

Thanks again for reporting a problem with the ScholarFolio profile${who}. It's been fixed.${note ? `\n\nWhat changed: ${note}` : ""}

See the profile: ${link}

If something still looks wrong, just reply to this email.`, reason, unsubToken);
  return { subject, html, text };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user || user.email !== ADMIN_EMAIL) return json({ error: "Unauthorized" }, 403);

    const body = await req.json().catch(() => ({}));
    if (typeof body.reportId !== "string") return json({ error: "reportId is required" }, 400);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    const notify = body.notify !== false;

    const { data: report, error } = await supabase
      .from("profile_reports")
      .select("id, author_id, author_name, reporter_email, user_id, page_url, notified_at")
      .eq("id", body.reportId).maybeSingle();
    if (error || !report) return json({ error: "Report not found" }, 404);

    const { error: upErr } = await supabase.from("profile_reports")
      .update({ resolved: true, resolved_note: note }).eq("id", report.id);
    if (upErr) return json({ error: upErr.message }, 400);

    const r = report as Report;
    if (!notify || !r.reporter_email || r.notified_at) {
      return json({ ok: true, notified: false, reason: !r.reporter_email ? "no-email" : r.notified_at ? "already-notified" : "skipped" });
    }

    const token = r.user_id ? await ensureUnsubToken(supabase, r.user_id) : null;
    const { subject, html, text } = render(r, note, token);
    const sent = await sendEmail(supabase, {
      to: r.reporter_email, subject, html, text, unsubToken: token, kind: "report_fixed", userId: r.user_id,
    });
    if (!sent.ok) return json({ ok: true, notified: false, reason: sent.error });
    await supabase.from("profile_reports").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
    return json({ ok: true, notified: true });
  } catch (e) {
    console.error("resolve-report error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
