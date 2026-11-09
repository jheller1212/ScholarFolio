import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { safeEqualHex, sha256 } from '../lib/orcidLink.ts';
import { PENDING_TTL_MS, isPlaceholderEmail } from '../lib/placeholderEmail.ts';

/**
 * Second half of placeholder-email-change. Supabase sends the browser here
 * after the NEW address's email-change link has been verified. The key from
 * that link proves the visitor read the new inbox; only then does the server
 * verify the old-address token on the placeholder's behalf, which completes
 * the change.
 */

const SITE_URL = 'https://scholarfolio.org';
const back = (query: string) => ({
  statusCode: 302,
  headers: { Location: `${SITE_URL}?${query}`, 'Cache-Control': 'no-store' },
});

interface PendingChange {
  token_hash?: unknown;
  key_hash?: unknown;
  new_email?: unknown;
  requested_at?: unknown;
}

const handler: Handler = async (event: HandlerEvent) => {
  const userId = event.queryStringParameters?.u ?? '';
  const key = event.queryStringParameters?.k ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) return back('email_error=invalid');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mixaxkywkojoclgbjjur.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return back('email_error=failed');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return back('email_error=invalid');

  const pending = (user.app_metadata?.pending_email_change ?? null) as PendingChange | null;
  if (!pending) {
    // Link opened twice: the first visit already finished the change.
    return isPlaceholderEmail(user.email) ? back('email_error=invalid') : back('email_confirmed=1');
  }
  const { token_hash: tokenHash, key_hash: keyHash, new_email: newEmail, requested_at: requestedAt } = pending;
  if (typeof tokenHash !== 'string' || typeof keyHash !== 'string' || typeof newEmail !== 'string' || typeof requestedAt !== 'number') {
    return back('email_error=invalid');
  }
  if (!safeEqualHex(sha256(key), keyHash)) return back('email_error=invalid');
  if (Date.now() - requestedAt > PENDING_TTL_MS) return back('email_error=expired');

  // Old-address side, vouched for by the server: a placeholder has no inbox.
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email_change', token_hash: tokenHash });
  if (verifyError) {
    console.error('placeholder-email-confirm verify:', verifyError.message);
    return back('email_error=failed');
  }

  const { data: after } = await supabase.auth.admin.getUserById(userId);
  if (after?.user?.email?.toLowerCase() !== newEmail) return back('email_error=failed');

  await supabase.auth.admin.updateUserById(userId, { app_metadata: { pending_email_change: null } });
  return back('email_confirmed=1');
};

export { handler };
