import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * Shared lifecycle-email plumbing for the CRON_SECRET / admin gated senders
 * (digest, nudges, report follow-ups). One place for the sender identity, the
 * unsubscribe token, the Resend call and the sent_emails audit row, so every
 * automated email carries a working opt-out and is recorded the same way.
 */

export const SITE = "https://scholarfolio.org";
const FROM = "Jonas at ScholarFolio <jonas@scholarfolio.org>";
const REPLY_TO = "info@scholarfolio.org";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function unsubscribeUrl(token: string): string {
  return `${SITE}/unsubscribe?token=${token}`;
}

/** Mask an address for logs: workflow output on a public repo is public. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** First name for a greeting, or null when we don't have a usable one. */
export function firstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** ORCID-only accounts get a placeholder login address that has no mailbox;
 *  mailing it bounces and hurts the sender's reputation. */
export function isDeliverableAddress(email: string | null | undefined): email is string {
  return !!email && !email.toLowerCase().endsWith("@orcid.scholarfolio.org");
}

export async function getUserEmail(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  const email = data?.user?.email ?? null;
  return isDeliverableAddress(email) ? email : null;
}

/** Return the user's stable unsubscribe token, creating an all-off
 *  preferences row if none exists. Never opts anyone into anything. */
export async function ensureUnsubToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("email_preferences").select("unsubscribe_token").eq("user_id", userId).maybeSingle();
  if (existing?.unsubscribe_token) return existing.unsubscribe_token as string;
  const { data: created, error } = await supabase
    .from("email_preferences")
    .insert({ user_id: userId, digest_opt_in: false, marketing_opt_in: false })
    .select("unsubscribe_token").single();
  if (error) { console.error("ensureUnsubToken:", error); return null; }
  return created.unsubscribe_token as string;
}

/** Wrap body HTML in the common layout with a footer stating why the
 *  recipient got this and, when a token exists, how to stop it. */
export function layoutHtml(bodyHtml: string, reason: string, unsubToken: string | null): string {
  const optOut = unsubToken
    ? ` <a href="${unsubscribeUrl(unsubToken)}" style="color:#94a3b8">Don't email me</a>.`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#334155;line-height:1.55">
${bodyHtml}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
  <p style="font-size:12px;color:#94a3b8">ScholarFolio is a free, open-source research project by Jonas Heller. ${escapeHtml(reason)}${optOut}</p>
</div>`;
}

export function layoutText(bodyText: string, reason: string, unsubToken: string | null): string {
  const optOut = unsubToken ? ` Opt out: ${unsubscribeUrl(unsubToken)}` : "";
  return `${bodyText}\n\n—\nScholarFolio is a free, open-source research project by Jonas Heller. ${reason}${optOut}`;
}

export function buttonHtml(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#2d7d7d;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adds a List-Unsubscribe header when present. */
  unsubToken: string | null;
  /** sent_emails.kind — also the dedup key callers check before sending. */
  kind: string;
  userId: string | null;
}

/** Send through Resend (the provider send-email uses) and record the send. */
export async function sendEmail(
  supabase: SupabaseClient,
  msg: OutgoingEmail,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isDeliverableAddress(msg.to)) return { ok: false, error: "undeliverable placeholder address" };
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  const headers: Record<string, string> = {};
  if (msg.unsubToken) headers["List-Unsubscribe"] = `<${unsubscribeUrl(msg.unsubToken)}>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [msg.to], reply_to: REPLY_TO,
      subject: msg.subject, html: msg.html, text: msg.text, headers,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}` };
  const id = body?.id as string | undefined;
  const { error } = await supabase.from("sent_emails").insert({
    user_id: msg.userId, recipient: msg.to, kind: msg.kind, resend_id: id ?? null,
  });
  // The email went out; a failed audit insert must not make the caller retry
  // (that would double-send), so log it and still report success.
  if (error) console.error("sent_emails insert failed:", error);
  return { ok: true, id };
}

/** Bearer check shared by the scheduled senders (GitHub Actions holds CRON_SECRET). */
export function hasCronSecret(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  return secret.length > 0 && bearer === secret;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
