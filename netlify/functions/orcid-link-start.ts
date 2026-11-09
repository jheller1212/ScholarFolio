import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { LINK_INTENT_TTL_MS, linkCookie, randomToken, sha256 } from '../lib/orcidLink.ts';

/**
 * Starts "connect ORCID to the account I'm signed in as". Verifies the
 * caller's Supabase JWT, then stores a single-use intent (hashes only) bound
 * to that user, the OAuth state it returns, and an HttpOnly browser cookie.
 * orcid-callback consumes the intent and links instead of signing in.
 */

const json = (statusCode: number, body: Record<string, unknown>, headers: Record<string, string> = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  body: JSON.stringify(body),
});

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mixaxkywkojoclgbjjur.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json(500, { error: 'Server misconfigured' });

  const jwt = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'Sign in first' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return json(401, { error: 'Sign in first' });

  const state = randomToken();
  const binding = randomToken();
  const now = Date.now();

  // One live intent per user; stale rows from abandoned attempts go too.
  await supabase.from('orcid_link_intents').delete().eq('user_id', user.id);
  await supabase.from('orcid_link_intents').delete().lt('expires_at', new Date(now).toISOString());

  const { error: insertError } = await supabase.from('orcid_link_intents').insert({
    state_hash: sha256(state),
    binding_hash: sha256(binding),
    user_id: user.id,
    expires_at: new Date(now + LINK_INTENT_TTL_MS).toISOString(),
  });
  if (insertError) return json(500, { error: 'Could not start ORCID linking' });

  return json(200, { state }, { 'Set-Cookie': linkCookie(binding, LINK_INTENT_TTL_MS / 1000) });
};

export { handler };
