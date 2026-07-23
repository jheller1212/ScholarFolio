import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * Profile error reports, with an immediate thank-you credit grant.
 *
 * Reports are the main way data-quality bugs reach us, so the flow stays open
 * to anonymous visitors — the report is what matters, the account is not.
 * Signed-in reporters get credits right away; anonymous ones can't be credited,
 * and the client tells them so rather than promising something we can't give.
 *
 * Deploy with: supabase functions deploy report-profile --no-verify-jwt
 */

const ALLOWED_ORIGINS = [
  'https://scholarfolio.org',
  'https://www.scholarfolio.org',
  'https://scholarfolio.netlify.app',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+--scholarfolio\.netlify\.app$/.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/** Credits granted per accepted report. */
const REPORT_CREDITS = 3;
/** Lifetime ceiling per account, so reporting can't be farmed for credits. */
const REPORT_CREDIT_CAP = 12;

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { authorId, authorName, message, reporterEmail, pageUrl } = body as {
      authorId?: string; authorName?: string; message?: string;
      reporterEmail?: string; pageUrl?: string;
    };

    if (typeof message !== 'string' || !message.trim()) {
      return json({ error: 'A description of the problem is required.' }, 400, req);
    }
    if (message.length > 2000) {
      return json({ error: 'Description must be at most 2000 characters.' }, 400, req);
    }
    if (reporterEmail && (typeof reporterEmail !== 'string' || reporterEmail.length > 320)) {
      return json({ error: 'Invalid email address.' }, 400, req);
    }

    // Optional auth: a missing or stale token still files the report.
    let userId: string | null = null;
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (jwt) {
      const { data: { user } } = await supabase.auth.getUser(jwt);
      userId = user?.id ?? null;
    }

    // Save the report and grant the credits in ONE database transaction. The
    // cap check has to happen under a row lock: when it was done here — read
    // the running total, then insert, then credit — two requests fired at once
    // both read "nothing granted yet" and both paid out, so the ceiling could
    // be walked past at will.
    const { data: granted, error: rpcError } = await supabase.rpc('submit_profile_report', {
      p_message: message,
      p_author_id: authorId ?? null,
      p_author_name: authorName ?? null,
      p_reporter_email: reporterEmail ?? null,
      p_page_url: pageUrl ?? null,
      p_user_id: userId,
      p_credits: REPORT_CREDITS,
      p_cap: REPORT_CREDIT_CAP,
    });

    if (rpcError) {
      console.error('report-profile: submit failed:', rpcError);
      return json({ error: 'Could not save your report. Please try again.' }, 500, req);
    }

    const creditsGranted = typeof granted === 'number' ? granted : 0;
    return json(
      {
        ok: true,
        creditsGranted,
        signedIn: Boolean(userId),
        capReached: Boolean(userId) && creditsGranted === 0,
      },
      200,
      req
    );
  } catch (err) {
    console.error('report-profile error:', err);
    return json({ error: 'Server error' }, 500, req);
  }
});
