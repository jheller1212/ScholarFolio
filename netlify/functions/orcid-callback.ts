import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  LINK_COOKIE, checkIntent, decideLink, linkCookie, looksLikeState, readCookie, sha256,
  type AccountSummary, type StoredIntent,
} from '../lib/orcidLink.ts';

const ORCID_TOKEN_URL = 'https://orcid.org/oauth/token';
const ORCID_API_URL = 'https://pub.orcid.org/v3.0';
const SITE_URL = 'https://scholarfolio.org';

interface OrcidEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/** Fetch public emails from the ORCID public API */
async function fetchOrcidEmails(orcidId: string): Promise<string[]> {
  try {
    const res = await fetch(`${ORCID_API_URL}/${orcidId}/email`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const emails: OrcidEmail[] = data?.email ?? [];
    return emails
      .filter((e) => e.email && e.verified)
      .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
      .map((e) => e.email.toLowerCase());
  } catch {
    return [];
  }
}

const redirect = (location: string, extra: Record<string, string> = {}) => ({
  statusCode: 302,
  headers: { Location: location, 'Cache-Control': 'no-store', ...extra },
});

/** Every response of a link attempt drops the binding cookie: intents are single use. */
const clearLinkCookie = { 'Set-Cookie': linkCookie('', 0) };

async function listAllUsers(supabase: SupabaseClient): Promise<User[]> {
  // Paged so returning users are found beyond the first 1000
  const allUsers: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError || !data?.users?.length) break;
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return allUsers;
}

/** Recorded in edge_function_errors so the admin dashboard shows them. */
async function logLinkEvent(supabase: SupabaseClient, action: string, message: string, context: Record<string, unknown>) {
  try {
    await supabase.from('edge_function_errors').insert({
      function_name: 'orcid-callback', action, error_message: message, context,
    });
  } catch {
    // Logging must never break the redirect.
  }
}

/**
 * Consume the link intent for this state, if any. Deleting and reading in one
 * statement makes it single use even if the callback URL is replayed.
 */
async function takeLinkIntent(supabase: SupabaseClient, state: string): Promise<StoredIntent | null> {
  if (!looksLikeState(state)) return null;
  const { data } = await supabase
    .from('orcid_link_intents')
    .delete()
    .eq('state_hash', sha256(state))
    .select('user_id, binding_hash, expires_at');
  return (data?.[0] as StoredIntent | undefined) ?? null;
}

/**
 * Attach the ORCID iD to the signed-in account that started the link. The
 * browser keeps its current session: no magic link for any other account.
 */
async function linkToUser(supabase: SupabaseClient, userId: string, orcidId: string, state: string) {
  const { data: targetData, error: targetError } = await supabase.auth.admin.getUserById(userId);
  const target = targetData?.user;
  if (targetError || !target) return redirect(`${SITE_URL}?orcid_error=link_failed`, clearLinkCookie);

  const holders = (await listAllUsers(supabase)).filter(
    (u) => u.id !== target.id && u.app_metadata?.orcid_id === orcidId
  );
  const claimed = new Set<string>();
  if (holders.length > 0) {
    const { data: claims } = await supabase
      .from('claimed_profiles').select('user_id').in('user_id', holders.map((h) => h.id));
    for (const c of claims ?? []) claimed.add((c as { user_id: string }).user_id);
  }
  const summarize = (u: User): AccountSummary => ({
    id: u.id,
    email: u.email ?? null,
    orcidId: typeof u.app_metadata?.orcid_id === 'string' ? u.app_metadata.orcid_id : null,
    hasClaim: claimed.has(u.id),
  });

  const decision = decideLink(orcidId, summarize(target), holders.map(summarize));

  if (decision.action === 'refuse') {
    await logLinkEvent(supabase, 'orcid-link-refused', `ORCID link refused: ${decision.reason}`, {
      orcid_id: orcidId, user_id: target.id, holder_user_id: decision.holderId ?? null, reason: decision.reason,
    });
    return redirect(`${SITE_URL}?orcid_error=${decision.reason}`, clearLinkCookie);
  }

  if (decision.action === 'link') {
    for (const fromId of decision.moveFrom) {
      // A null value deletes the key; the rest of the metadata is left alone.
      const { error: moveError } = await supabase.auth.admin.updateUserById(fromId, {
        app_metadata: { orcid_id: null },
        user_metadata: { orcid_id: null },
      });
      if (moveError) return redirect(`${SITE_URL}?orcid_error=link_failed`, clearLinkCookie);
      await logLinkEvent(supabase, 'orcid-link-moved', 'ORCID iD moved from a placeholder account', {
        orcid_id: orcidId, from_user_id: fromId, to_user_id: target.id,
      });
    }
    const { error: linkError } = await supabase.auth.admin.updateUserById(target.id, {
      // app_metadata is the verified source; user_metadata keeps a copy for display.
      app_metadata: { orcid_id: orcidId },
      user_metadata: { orcid_id: orcidId },
    });
    if (linkError) return redirect(`${SITE_URL}?orcid_error=link_failed`, clearLinkCookie);
  }

  return redirect(`${SITE_URL}?orcid_state=${encodeURIComponent(state)}&orcid_linked=1`, clearLinkCookie);
}

const handler: Handler = async (event: HandlerEvent) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;
  const state = event.queryStringParameters?.state;

  if (error || !code) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=access_denied` },
    };
  }

  if (!state) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=invalid_state` },
    };
  }

  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mixaxkywkojoclgbjjur.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !serviceRoleKey) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=config` },
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // A signed-in user connecting ORCID: consumed before the code exchange so a
  // replayed callback finds nothing. Once an intent matched, this request is
  // a link attempt and never falls back to signing anyone in.
  const intent = await takeLinkIntent(supabase, state);
  let linkUserId: string | null = null;
  if (intent) {
    const check = checkIntent(intent, readCookie(event.headers.cookie, LINK_COOKIE), Date.now());
    if (!check.ok) return redirect(`${SITE_URL}?orcid_error=${check.reason}`, clearLinkCookie);
    linkUserId = check.userId;
  }

  // Exchange authorization code for access token + ORCID iD
  let orcidId: string;
  let orcidName: string;
  try {
    const tokenRes = await fetch(ORCID_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${SITE_URL}/api/orcid-callback`,
      }),
    });

    if (!tokenRes.ok) {
      return {
        statusCode: 302,
        headers: { Location: `${SITE_URL}?orcid_error=token_exchange` },
      };
    }

    const tokenData = await tokenRes.json();
    orcidId = tokenData.orcid;
    orcidName = tokenData.name || '';
  } catch {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=token_exchange` },
    };
  }

  if (!orcidId) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=no_orcid` },
    };
  }

  if (linkUserId) return linkToUser(supabase, linkUserId, orcidId, state);

  const syntheticEmail = `${orcidId.replace(/-/g, '')}@orcid.scholarfolio.org`;

  const allUsers = await listAllUsers(supabase);

  // Priority 1: Find user who already has this ORCID linked (returning ORCID user).
  // Only app_metadata counts: users can rewrite their own user_metadata from the
  // browser, so a user_metadata ORCID proves nothing.
  let matchedUser = allUsers.find((u) => u.app_metadata?.orcid_id === orcidId) ?? null;

  // Priority 2: Match by email from ORCID's public profile
  if (!matchedUser) {
    const orcidEmails = await fetchOrcidEmails(orcidId);
    if (orcidEmails.length > 0) {
      matchedUser = allUsers.find(
        (u) => u.email && orcidEmails.includes(u.email.toLowerCase())
      ) ?? null;
    }
  }

  // Priority 3: Check for synthetic email (legacy ORCID-only user)
  if (!matchedUser) {
    matchedUser = allUsers.find((u) => u.email === syntheticEmail) ?? null;
  }

  // Link ORCID iD to existing user if not already set
  if (matchedUser && matchedUser.app_metadata?.orcid_id !== orcidId) {
    await supabase.auth.admin.updateUserById(matchedUser.id, {
      // app_metadata is the verified source; user_metadata keeps a copy for display.
      app_metadata: { ...matchedUser.app_metadata, orcid_id: orcidId },
      user_metadata: { ...matchedUser.user_metadata, orcid_id: orcidId },
    });
  }

  let signInEmail: string;

  if (matchedUser) {
    signInEmail = matchedUser.email!;
  } else {
    // No existing user found — create new with synthetic email
    signInEmail = syntheticEmail;
    const { error: createError } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      app_metadata: { orcid_id: orcidId },
      user_metadata: {
        orcid_id: orcidId,
        full_name: orcidName,
        provider: 'orcid',
      },
    });

    if (createError) {
      return {
        statusCode: 302,
        headers: { Location: `${SITE_URL}?orcid_error=create_user` },
      };
    }
  }

  // Generate a magic link for automatic sign-in; pass state back so the SPA can verify it
  const redirectTo = `${SITE_URL}?orcid_state=${encodeURIComponent(state)}`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: signInEmail,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=session` },
    };
  }

  return {
    statusCode: 302,
    headers: { Location: linkData.properties.action_link },
  };
};

export { handler };
