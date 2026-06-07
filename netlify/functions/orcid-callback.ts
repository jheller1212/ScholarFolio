import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const ORCID_TOKEN_URL = 'https://orcid.org/oauth/token';
const SITE_URL = 'https://scholarfolio.org';

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

  // Create or find Supabase user by synthetic email derived from ORCID iD
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const syntheticEmail = `${orcidId.replace(/-/g, '')}@orcid.scholarfolio.org`;

  // Try to find existing user by synthetic email
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = users?.find(
    (u) => u.email === syntheticEmail || u.user_metadata?.orcid_id === orcidId
  );

  if (existingUser) {
    // Update name if it changed
    if (orcidName && existingUser.user_metadata?.full_name !== orcidName) {
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, full_name: orcidName },
      });
    }
  } else {
    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: {
        orcid_id: orcidId,
        full_name: orcidName,
        provider: 'orcid',
      },
    });

    if (createError || !newUser.user) {
      return {
        statusCode: 302,
        headers: { Location: `${SITE_URL}?orcid_error=create_user` },
      };
    }
  }

  // Generate a magic link for automatic sign-in
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
    options: { redirectTo: SITE_URL },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return {
      statusCode: 302,
      headers: { Location: `${SITE_URL}?orcid_error=session` },
    };
  }

  // Redirect to Supabase's verify endpoint which will set the session
  return {
    statusCode: 302,
    headers: { Location: linkData.properties.action_link },
  };
};

export { handler };
