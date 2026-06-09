import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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

const handler: Handler = async (event: HandlerEvent) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;

  if (error || !code) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=access_denied` },
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  // Priority 1: Find user who already has this ORCID linked (returning ORCID user)
  let matchedUser = users?.find((u) => u.user_metadata?.orcid_id === orcidId);

  // Priority 2: Match by email from ORCID's public profile
  if (!matchedUser) {
    const orcidEmails = await fetchOrcidEmails(orcidId);
    if (orcidEmails.length > 0) {
      matchedUser = users?.find(
        (u) => u.email && orcidEmails.includes(u.email.toLowerCase())
      );
    }
  }

  // Priority 3: Check for synthetic email (legacy ORCID-only user)
  const syntheticEmail = `${orcidId.replace(/-/g, '')}@orcid.scholarfolio.org`;
  if (!matchedUser) {
    matchedUser = users?.find((u) => u.email === syntheticEmail);
  }

  let signInEmail: string;

  if (matchedUser) {
    signInEmail = matchedUser.email!;
    // Link ORCID iD to existing user if not already set
    if (matchedUser.user_metadata?.orcid_id !== orcidId) {
      await supabase.auth.admin.updateUserById(matchedUser.id, {
        user_metadata: { ...matchedUser.user_metadata, orcid_id: orcidId },
      });
    }
  } else {
    // No existing user found — create new with synthetic email
    signInEmail = syntheticEmail;
    const { error: createError } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
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

  // Generate a magic link for automatic sign-in
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: signInEmail,
    options: { redirectTo: SITE_URL },
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
