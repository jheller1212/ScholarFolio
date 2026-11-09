import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkNewEmail, checkRate, confirmationEmail, isPlaceholderEmail } from '../lib/placeholderEmail.ts';
import { randomToken, sha256 } from '../lib/orcidLink.ts';

/**
 * "Where should we send your updates?" for ORCID-only (placeholder) accounts.
 *
 * With Supabase's secure email change ON, a change must be confirmed from
 * the old AND the new address; a placeholder has no mailbox, so a plain
 * updateUser({ email }) would stay pending forever. Here the server mints
 * both email-change tokens via the admin API and emails ONLY the new-address
 * link. That link returns through placeholder-email-confirm, which then
 * vouches for the old side. So the change completes only after the new
 * address clicks. Real-email accounts are refused and keep the normal flow.
 */

const SITE_URL = 'https://scholarfolio.org';

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/** Another account already logs in with, or has a pending change to, this address. */
async function emailInUse(supabase: SupabaseClient, email: string, selfId: string): Promise<boolean> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return false; // generateLink still enforces uniqueness
    const users = data?.users ?? [];
    if (users.some((u) => u.id !== selfId && (u.email?.toLowerCase() === email || u.new_email?.toLowerCase() === email))) {
      return true;
    }
    if (users.length < 1000) return false;
  }
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mixaxkywkojoclgbjjur.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('placeholder-email-change: SUPABASE_SERVICE_ROLE_KEY missing');
    return json(500, { error: 'server_misconfigured' });
  }

  const jwt = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'sign_in' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return json(401, { error: 'sign_in' });

  // Only placeholder accounts skip the old-address confirmation.
  if (!isPlaceholderEmail(user.email)) return json(403, { error: 'not_placeholder' });

  let body: unknown = null;
  try { body = JSON.parse(event.body || 'null'); } catch { /* handled below */ }
  const check = checkNewEmail(body && typeof body === 'object' ? (body as { email?: unknown }).email : undefined);
  if (!check.ok) return json(400, { error: check.error });
  const newEmail = check.email;

  const rate = checkRate(user.app_metadata?.email_change_requests, Date.now());
  if (!rate.ok) return json(429, { error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds });
  // Counted before sending so failures can't be used to probe without limit.
  await supabase.auth.admin.updateUserById(user.id, { app_metadata: { email_change_requests: rate.history } });

  // GoTrue's generateLink also refuses duplicates; this gives a clear answer first.
  if (await emailInUse(supabase, newEmail, user.id)) return json(409, { error: 'email_taken' });

  // The key travels only inside the link mailed to the new address, so only
  // whoever reads that inbox can finish the change.
  const key = randomToken();
  const confirmUrl = `${SITE_URL}/api/placeholder-email-confirm?u=${encodeURIComponent(user.id)}&k=${key}`;
  const current = await supabase.auth.admin.generateLink({
    type: 'email_change_current', email: user.email!, newEmail,
  });
  // Generated second: it resets the confirm status and keeps the current token.
  const next = await supabase.auth.admin.generateLink({
    type: 'email_change_new', email: user.email!, newEmail, options: { redirectTo: confirmUrl },
  });
  const linkError = current.error || next.error;
  if (linkError) {
    const taken = /already|registered|exists/i.test(linkError.message);
    if (!taken) console.error('placeholder-email-change generateLink:', linkError.message);
    return json(taken ? 409 : 500, { error: taken ? 'email_taken' : 'link_failed' });
  }
  const currentHash = current.data.properties?.hashed_token;
  const actionLink = next.data.properties?.action_link;
  if (!currentHash || !actionLink) return json(500, { error: 'link_failed' });

  // Kept server-writable only (app_metadata); used once the new address clicks.
  const { error: storeError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { pending_email_change: { token_hash: currentHash, key_hash: sha256(key), new_email: newEmail, requested_at: Date.now() } },
  });
  if (storeError) return json(500, { error: 'link_failed' });

  const { subject, html, text } = confirmationEmail(actionLink);
  // Sent by the send-account-email edge function: the Resend key lives only in
  // Supabase secrets, and that function also records the send in sent_emails.
  const res = await fetch(`${supabaseUrl}/functions/v1/send-account-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: newEmail, subject, html, text, kind: 'email_change', userId: user.id }),
  });
  if (!res.ok) {
    console.error('placeholder-email-change send:', res.status);
    return json(502, { error: 'send_failed' });
  }

  return json(200, { sentTo: newEmail });
};

export { handler };
