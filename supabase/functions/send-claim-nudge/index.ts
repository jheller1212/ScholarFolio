import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * ORCID-verification nudge — a service email to people who claimed a profile
 * but never verified it. It's about the recipient's own claim (a service
 * matter, lawful without marketing consent) and carries a soft invitation to
 * turn on the monthly citation digest.
 *
 * Modes (POST body):
 *   { "test": true, "to": "you@example.com" }  → one email to that address only
 *   { "live": true }                            → every unverified claimer not
 *                                                 already nudged (dedup via
 *                                                 sent_emails.kind='claim_nudge')
 *
 * Auth: service-role bearer only (same as snapshot-metrics).
 * Deploy with: supabase functions deploy send-claim-nudge --no-verify-jwt
 */

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", SERVICE_KEY);

const FROM = "Jonas at ScholarFolio <jonas@scholarfolio.org>";
const REPLY_TO = "info@scholarfolio.org";
const SITE = "https://scholarfolio.org";

interface Target {
  user_id: string | null;
  email: string;
  name: string | null;
  slug: string | null;
  unsubscribe_token: string;
}

/** Ensure the recipient has an email_preferences row so a stable unsubscribe
 *  token exists, and return it. Does not opt them into anything. */
async function ensureUnsubToken(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("email_preferences").select("unsubscribe_token").eq("user_id", userId).maybeSingle();
  if (existing?.unsubscribe_token) return existing.unsubscribe_token;
  const { data: created, error } = await supabase
    .from("email_preferences")
    .insert({ user_id: userId, digest_opt_in: false, marketing_opt_in: false })
    .select("unsubscribe_token").single();
  if (error) { console.error("ensureUnsubToken:", error); return null; }
  return created.unsubscribe_token;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderEmail(t: Target): { subject: string; html: string; text: string } {
  const greeting = t.name ? `Hi ${escapeHtml(t.name.split(" ")[0])},` : "Hi there,";
  const profileUrl = t.slug ? `${SITE}/${t.slug}` : SITE;
  const unsubUrl = `${SITE}/unsubscribe?token=${t.unsubscribe_token}`;

  const subject = "Verify your ScholarFolio profile with ORCID";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#334155;line-height:1.55">
  <p>${greeting}</p>
  <p>You claimed your researcher profile on <a href="${profileUrl}" style="color:#2d7d7d">ScholarFolio</a> — thank you. It's currently <b>unverified</b>.</p>
  <p>Verifying with your <b>ORCID iD</b> takes about 30 seconds and gives you a verified badge, the ability to correct your profile details, and a permanent link you can share.</p>
  <p style="margin:24px 0">
    <a href="${profileUrl}" style="background:#2d7d7d;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">Verify my profile</a>
  </p>
  <p style="font-size:14px;color:#64748b">P.S. Want a short monthly email when your citation metrics change? You can turn that on from your account menu once you're signed in — it's off by default.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="font-size:12px;color:#94a3b8">ScholarFolio is an independent personal project by Jonas Heller. You're receiving this because you claimed a profile.
  <a href="${unsubUrl}" style="color:#94a3b8">Don't email me</a>.</p>
</div>`;
  const text = `${t.name ? `Hi ${t.name.split(" ")[0]},` : "Hi there,"}

You claimed your researcher profile on ScholarFolio (${profileUrl}) — thank you. It's currently unverified.

Verifying with your ORCID iD takes about 30 seconds and gives you a verified badge, the ability to correct your profile, and a permanent shareable link:

${profileUrl}

P.S. Want a short monthly email when your citation metrics change? Turn it on from your account menu once signed in — it's off by default.

—
ScholarFolio is an independent personal project by Jonas Heller. You claimed a profile, which is why you got this. Opt out: ${unsubUrl}`;
  return { subject, html, text };
}

async function sendOne(t: Target, kind: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { subject, html, text } = renderEmail(t);
  const unsubUrl = `${SITE}/unsubscribe?token=${t.unsubscribe_token}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [t.email], reply_to: REPLY_TO, subject, html, text,
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}` };
  const id = body?.id as string | undefined;
  await supabase.from("sent_emails").insert({ user_id: t.user_id, recipient: t.email, kind, resend_id: id ?? null });
  return { ok: true, id };
}

Deno.serve(async (req) => {
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!CRON_SECRET || bearer !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const body = await req.json().catch(() => ({}));

  // TEST: one email to the given address, using a sample profile. Nothing else.
  if (body.test && typeof body.to === "string") {
    const sample: Target = {
      user_id: null, email: body.to, name: "Jonas", slug: "jonas-heller",
      unsubscribe_token: "00000000-0000-4000-8000-000000000000",
    };
    const r = await sendOne(sample, "test");
    return new Response(JSON.stringify(r), { status: r.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
  }

  if (!body.live) {
    return new Response(JSON.stringify({ error: 'Pass {"test":true,"to":"..."} or {"live":true}' }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // LIVE: every unverified claimer not already nudged.
  const { data: claims, error } = await supabase
    .from("claimed_profiles")
    .select("user_id, slug, display_name, verified")
    .eq("verified", false);
  if (error) return new Response(JSON.stringify({ error: "query failed" }), { status: 500, headers: { "Content-Type": "application/json" } });

  const { data: already } = await supabase.from("sent_emails").select("user_id").eq("kind", "claim_nudge");
  const nudged = new Set((already ?? []).map((r: { user_id: string | null }) => r.user_id));

  let sent = 0; const failures: string[] = [];
  for (const c of claims ?? []) {
    if (!c.user_id || nudged.has(c.user_id)) continue;
    const { data: u } = await supabase.auth.admin.getUserById(c.user_id);
    const email = u?.user?.email;
    if (!email) { failures.push(`${c.slug}:no-email`); continue; }
    const token = await ensureUnsubToken(c.user_id);
    if (!token) { failures.push(`${c.slug}:no-token`); continue; }
    const r = await sendOne(
      { user_id: c.user_id, email, name: c.display_name, slug: c.slug, unsubscribe_token: token },
      "claim_nudge"
    );
    if (r.ok) sent++; else failures.push(`${c.slug}:${r.error}`);
  }
  return new Response(JSON.stringify({ ok: true, sent, failures }), { status: 200, headers: { "Content-Type": "application/json" } });
});
