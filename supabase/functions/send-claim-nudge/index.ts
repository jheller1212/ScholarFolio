import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import {
  SITE, buttonHtml, ensureUnsubToken, escapeHtml, firstName, hasCronSecret, jsonResponse,
  layoutHtml, layoutText, maskEmail, sendEmail,
} from "../_shared/mailer.ts";
import { NUDGE_WINDOW_DAYS, hasOptedOut, inNudgeWindow, type Prefs } from "./targeting.ts";

/**
 * Lifecycle nudges (one each, ever, per account):
 *  - claim_reminder  — signed up 3+ days ago, never claimed a profile.
 *  - finish_profile  — claimed 3+ days ago: pronouns, hide wrong papers,
 *                      badge, digest opt-in.
 * Claiming now requires ORCID, so the old "claimed but unverified" nudge has no
 * audience left and is gone. Both respect email preferences (see
 * hasOptedOut) and carry an unsubscribe link. Run daily by the
 * lifecycle-emails workflow; the 3–14 day window keeps it to recent accounts.
 *
 * POST body:
 *   { "live": true }                         → send both kinds
 *   { "dryRun": true }                       → list who would get what, send nothing
 *   { "test": true, "to": "...", "kind": "claim_reminder" | "finish_profile" }
 *                                            → one sample email to that address only
 *   optional "windowDays" (default 14)
 *
 * Auth: CRON_SECRET bearer. Deploy with --no-verify-jwt.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

type Kind = "claim_reminder" | "finish_profile";

interface Target { userId: string | null; email: string; name: string | null; slug: string | null; digestOn: boolean }

function renderClaimReminder(t: Target, token: string | null) {
  const greet = firstName(t.name);
  const reason = "You created a ScholarFolio account.";
  const subject = "Your researcher profile is one step away";
  const html = layoutHtml(`
  <p>${greet ? `Hi ${escapeHtml(greet)},` : "Hi,"}</p>
  <p>Thanks for signing up to ScholarFolio. You haven't claimed your profile yet: search your name, click <b>Claim profile</b> and confirm with your ORCID iD. It takes about a minute.</p>
  <p>Claiming gets you a permanent link (scholarfolio.org/your-name), a verified badge, and lets you fix anything the data got wrong. Your own profile never counts against your monthly lookups.</p>
  ${buttonHtml(SITE, "Find and claim my profile")}`, reason, token);
  const text = layoutText(`${greet ? `Hi ${greet},` : "Hi,"}

Thanks for signing up to ScholarFolio. You haven't claimed your profile yet: search your name, click "Claim profile" and confirm with your ORCID iD. It takes about a minute.

Claiming gets you a permanent link, a verified badge, and lets you fix anything the data got wrong. Your own profile never counts against your monthly lookups.

${SITE}`, reason, token);
  return { subject, html, text };
}

function renderFinishProfile(t: Target, token: string | null) {
  const greet = firstName(t.name);
  const url = t.slug ? `${SITE}/${t.slug}` : SITE;
  const reason = "You claimed a profile on ScholarFolio.";
  const subject = "Three small things to finish your ScholarFolio profile";
  const digest = t.digestOn ? "" : `<li><b>Monthly digest</b> — a short email when your citations change. Turn it on under Email preferences in your account menu.</li>`;
  const html = layoutHtml(`
  <p>${greet ? `Hi ${escapeHtml(greet)},` : "Hi,"}</p>
  <p>Your profile at <a href="${url}" style="color:#2d7d7d">${escapeHtml(url.replace("https://", ""))}</a> is live. A few minutes makes it yours:</p>
  <ul style="padding-left:18px">
    <li><b>Pronouns and title</b> — the narrative uses they/them until you tell us otherwise. Edit them from your profile page.</li>
    <li><b>Papers that aren't yours</b> — hide them from the same place.</li>
    <li><b>Badge</b> — the <i>Embed</i> button gives you a badge for your website or email signature.</li>
    ${digest}
  </ul>
  ${buttonHtml(url, "Open my profile")}`, reason, token);
  const text = layoutText(`${greet ? `Hi ${greet},` : "Hi,"}

Your profile at ${url} is live. A few minutes makes it yours:

- Pronouns and title: the narrative uses they/them until you tell us otherwise. Edit them from your profile page.
- Papers that aren't yours: hide them from the same place.
- Badge: the "Embed" button gives you a badge for your website or email signature.${t.digestOn ? "" : "\n- Monthly digest: a short email when your citations change. Turn it on under Email preferences in your account menu."}

${url}`, reason, token);
  return { subject, html, text };
}

const RENDER: Record<Kind, (t: Target, token: string | null) => { subject: string; html: string; text: string }> = {
  claim_reminder: renderClaimReminder,
  finish_profile: renderFinishProfile,
};

async function listAllUsers(): Promise<Array<{ id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> }>> {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return all;
}

async function collectTargets(windowDays: number): Promise<Array<{ kind: Kind; target: Target }>> {
  const now = new Date();
  const [users, claimsRes, prefsRes, sentRes] = await Promise.all([
    listAllUsers(),
    supabase.from("claimed_profiles").select("user_id, slug, display_name, verified, created_at"),
    supabase.from("email_preferences").select("user_id, digest_opt_in, marketing_opt_in, consent_source"),
    supabase.from("sent_emails").select("user_id, kind").in("kind", ["claim_reminder", "finish_profile"]),
  ]);
  const claims = new Map((claimsRes.data ?? []).map((c: { user_id: string }) => [c.user_id, c]));
  const prefs = new Map((prefsRes.data ?? []).map((p: Prefs & { user_id: string }) => [p.user_id, p]));
  const sent = new Set((sentRes.data ?? []).map((s: { user_id: string | null; kind: string }) => `${s.kind}:${s.user_id}`));

  const out: Array<{ kind: Kind; target: Target }> = [];
  for (const u of users) {
    if (!u.email || hasOptedOut(prefs.get(u.id))) continue;
    const claim = claims.get(u.id) as
      { slug: string; display_name: string | null; verified: boolean; created_at: string } | undefined;
    const meta = u.user_metadata ?? {};
    const name = (claim?.display_name ?? (typeof meta.full_name === "string" ? meta.full_name : null)) || null;
    const base = { userId: u.id, email: u.email, name, slug: claim?.slug ?? null, digestOn: Boolean(prefs.get(u.id)?.digest_opt_in) };

    if (!claim) {
      if (inNudgeWindow(u.created_at, now, windowDays) && !sent.has(`claim_reminder:${u.id}`)) {
        out.push({ kind: "claim_reminder", target: base });
      }
    } else if (claim.verified && inNudgeWindow(claim.created_at, now, windowDays) && !sent.has(`finish_profile:${u.id}`)) {
      out.push({ kind: "finish_profile", target: base });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (!hasCronSecret(req)) return jsonResponse({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  // TEST: one sample email to the given address. Nothing else.
  if (body.test && typeof body.to === "string") {
    const kind: Kind = body.kind === "finish_profile" ? "finish_profile" : "claim_reminder";
    const sample: Target = { userId: null, email: body.to, name: "Jonas Heller", slug: "jonas-heller", digestOn: false };
    const { subject, html, text } = RENDER[kind](sample, null);
    const r = await sendEmail(supabase, { to: body.to, subject, html, text, unsubToken: null, kind: "test", userId: null });
    return jsonResponse(r, r.ok ? 200 : 502);
  }

  if (!body.live && !body.dryRun) {
    return jsonResponse({ error: 'Pass {"live":true}, {"dryRun":true} or {"test":true,"to":"..."}' }, 400);
  }

  const windowDays = Number.isInteger(body.windowDays) && body.windowDays >= 3 && body.windowDays <= 60
    ? body.windowDays as number
    : NUDGE_WINDOW_DAYS;

  let targets;
  try {
    targets = await collectTargets(windowDays);
  } catch (e) {
    console.error("send-claim-nudge: target query failed:", e);
    return jsonResponse({ error: "query failed" }, 500);
  }

  if (body.dryRun) {
    return jsonResponse({
      ok: true, dryRun: true, windowDays,
      wouldSend: targets.map(t => ({ kind: t.kind, to: maskEmail(t.target.email), slug: t.target.slug })),
    });
  }

  const sent: Record<Kind, number> = { claim_reminder: 0, finish_profile: 0 };
  const failures: string[] = [];
  for (const { kind, target } of targets) {
    const token = target.userId ? await ensureUnsubToken(supabase, target.userId) : null;
    const { subject, html, text } = RENDER[kind](target, token);
    const r = await sendEmail(supabase, { to: target.email, subject, html, text, unsubToken: token, kind, userId: target.userId });
    if (r.ok) sent[kind]++; else failures.push(`${kind}:${maskEmail(target.email)}:${r.error}`);
  }
  return jsonResponse({ ok: true, windowDays, sent, failures });
});
