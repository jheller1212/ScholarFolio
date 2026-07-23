import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  'https://scholarfolio.org',
  'https://www.scholarfolio.org',
  'https://scholarfolio.netlify.app',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--scholarfolio\.netlify\.app$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const FEEDBACK_CREDIT_CAP = 20;
const FIRST_SUBMISSION_CREDITS = 5;
const SUBSEQUENT_CREDITS = 2;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const { rating, comment, profileViewed, source } = body;

    // Validate source
    if (source !== 'prompt' && source !== 'button') {
      return new Response(
        JSON.stringify({ error: 'Invalid source. Must be "prompt" or "button".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate rating
    if (rating !== undefined && rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return new Response(
          JSON.stringify({ error: 'Rating must be an integer between 1 and 5.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate comment
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string' || comment.length > 2000) {
        return new Response(
          JSON.stringify({ error: 'Comment must be a string of at most 2000 characters.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Save the feedback and grant credits in ONE transaction. Doing the cap
    // check here — read the running total, then insert, then credit — let two
    // simultaneous submissions both read the same total and both pay out.
    const { data: grantedRaw, error: rpcError } = await supabase.rpc('submit_feedback_with_credits', {
      p_user_id: userId,
      p_rating: rating ?? null,
      p_comment: comment ?? null,
      p_profile_viewed: profileViewed ?? null,
      p_source: source,
      p_first_credits: FIRST_SUBMISSION_CREDITS,
      p_subsequent_credits: SUBSEQUENT_CREDITS,
      p_cap: FEEDBACK_CREDIT_CAP,
    });

    if (rpcError) {
      console.error('Error saving feedback:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to save feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creditsToGrant: number = typeof grantedRaw === 'number' ? grantedRaw : 0;

    const message = creditsToGrant > 0
      ? `Thank you for your feedback! You've earned ${creditsToGrant} credit${creditsToGrant !== 1 ? 's' : ''}.`
      : 'Thank you for your feedback!';

    return new Response(
      JSON.stringify({ credits_granted: creditsToGrant, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Submit feedback error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit feedback' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
