import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

/**
 * Profile error reports.
 *
 * Reports are the main way data-quality bugs reach us, so the flow stays open
 * to anonymous visitors. There is no credit reward any more (ScholarFolio is
 * not a credits business); the thank-you is fixing it and telling the reporter
 * — which is why the email field matters: resolve-report emails "fixed" to it.
 *
 * Actions (POST body):
 *   { message, authorId?, authorName?, reporterEmail?, pageUrl? } → file a report, returns { reportId }
 *   { action: "feedback", reportId, rating: 1|2|3 }               → one-question "how easy was this?"
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

// Deliberately loose: we only need something mail can be delivered to.
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function clip(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
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

    // One-question follow-up. The report id is an unguessable uuid handed only
    // to the submitter, and the answer can be set once, so this needs no auth.
    if (body.action === 'feedback') {
      const rating = Number(body.rating);
      if (typeof body.reportId !== 'string' || !UUID_RE.test(body.reportId) || ![1, 2, 3].includes(rating)) {
        return json({ error: 'Invalid feedback' }, 400, req);
      }
      const { error } = await supabase.from('profile_reports')
        .update({ reporter_feedback: rating })
        .eq('id', body.reportId).is('reporter_feedback', null);
      if (error) return json({ error: 'Could not save feedback' }, 500, req);
      return json({ ok: true }, 200, req);
    }

    const { message, reporterEmail } = body as { message?: unknown; reporterEmail?: unknown };
    if (typeof message !== 'string' || !message.trim()) {
      return json({ error: 'A description of the problem is required.' }, 400, req);
    }
    if (message.length > 2000) {
      return json({ error: 'Description must be at most 2000 characters.' }, 400, req);
    }
    let email: string | null = null;
    if (reporterEmail !== undefined && reporterEmail !== null && reporterEmail !== '') {
      if (typeof reporterEmail !== 'string' || reporterEmail.length > 320 || !EMAIL_RE.test(reporterEmail.trim())) {
        return json({ error: 'That email address looks incomplete.' }, 400, req);
      }
      email = reporterEmail.trim();
    }

    // Optional auth: a missing or stale token still files the report.
    let userId: string | null = null;
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (jwt) {
      const { data: { user } } = await supabase.auth.getUser(jwt);
      userId = user?.id ?? null;
    }

    const { data, error } = await supabase.from('profile_reports').insert({
      message: message.trim(),
      author_id: clip(body.authorId, 200) ?? 'unknown',
      author_name: clip(body.authorName, 300),
      reporter_email: email,
      page_url: clip(body.pageUrl, 1000),
      user_id: userId,
      credits_granted: 0,
    }).select('id').single();

    if (error || !data) {
      console.error('report-profile: insert failed:', error);
      return json({ error: 'Could not save your report. Please try again.' }, 500, req);
    }
    return json({ ok: true, reportId: data.id, signedIn: Boolean(userId), willNotify: Boolean(email) }, 200, req);
  } catch (err) {
    console.error('report-profile error:', err);
    return json({ error: 'Server error' }, 500, req);
  }
});
