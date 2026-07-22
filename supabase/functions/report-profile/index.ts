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

    // Decide the grant before inserting, so the report row records what was given.
    let creditsToGrant = 0;
    let capReached = false;
    if (userId) {
      const { data: priorRows, error: priorError } = await supabase
        .from('profile_reports')
        .select('credits_granted')
        .eq('user_id', userId);
      if (priorError) {
        console.error('report-profile: prior credits lookup failed:', priorError);
      } else {
        const alreadyGranted = (priorRows ?? []).reduce(
          (sum: number, row: { credits_granted: number | null }) => sum + (row.credits_granted ?? 0),
          0
        );
        creditsToGrant = Math.max(0, Math.min(REPORT_CREDITS, REPORT_CREDIT_CAP - alreadyGranted));
        capReached = creditsToGrant === 0;
      }
    }

    const { error: insertError } = await supabase.from('profile_reports').insert({
      author_id: authorId ?? null,
      author_name: authorName ?? null,
      reporter_email: reporterEmail?.trim() || null,
      message: message.trim(),
      page_url: pageUrl ?? null,
      user_id: userId,
      credits_granted: creditsToGrant,
    });

    if (insertError) {
      console.error('report-profile: insert failed:', insertError);
      return json({ error: 'Could not save your report. Please try again.' }, 500, req);
    }

    if (creditsToGrant > 0 && userId) {
      const { error: creditError } = await supabase.rpc('increment_credits', {
        p_user_id: userId,
        p_amount: creditsToGrant,
      });
      if (creditError) {
        // The report is saved and matters more than the credits; report the
        // grant honestly as zero rather than claiming credits that didn't land.
        console.error('report-profile: credit grant failed:', creditError);
        await supabase.from('profile_reports')
          .update({ credits_granted: 0 })
          .eq('user_id', userId)
          .eq('message', message.trim());
        return json({ ok: true, creditsGranted: 0, signedIn: true, capReached: false }, 200, req);
      }
    }

    return json(
      { ok: true, creditsGranted: creditsToGrant, signedIn: Boolean(userId), capReached },
      200,
      req
    );
  } catch (err) {
    console.error('report-profile error:', err);
    return json({ error: 'Server error' }, 500, req);
  }
});
