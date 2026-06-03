import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  'https://scholarfolio.org',
  'https://www.scholarfolio.org',
  'https://scholarfolio.netlify.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Fetch all user-related data in parallel
    const [credits, purchases, claimedProfiles, requestLogs] = await Promise.all([
      supabase.from('user_credits').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('credit_purchases').select('pack_id, credits, amount, created_at').eq('user_id', userId),
      supabase.from('claimed_profiles').select('slug, author_id, display_name, bio, created_at').eq('user_id', userId),
      supabase.from('request_logs').select('created_at, source').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      credits: credits.data ? {
        balance: credits.data.credits,
        updated_at: credits.data.updated_at,
      } : null,
      purchases: purchases.data || [],
      claimed_profiles: claimedProfiles.data || [],
      request_logs: (requestLogs.data || []).map(log => ({
        timestamp: log.created_at,
        type: log.source,
      })),
    };

    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="scholarfolio-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('[ExportData] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
