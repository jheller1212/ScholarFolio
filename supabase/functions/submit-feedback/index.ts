import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGINS = [
  'https://scholarfolio.org',
  'https://www.scholarfolio.org',
  'https://scholarfolio.netlify.app',
  'http://localhost:5173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

    // Query total credits already granted to this user from feedback
    const { data: sumData, error: sumError } = await supabase
      .from('feedback')
      .select('credits_granted')
      .eq('user_id', userId);

    if (sumError) {
      console.error('Error querying feedback credits:', sumError);
      return new Response(
        JSON.stringify({ error: 'Failed to process feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalCreditsGranted = (sumData ?? []).reduce(
      (sum: number, row: { credits_granted: number }) => sum + (row.credits_granted ?? 0),
      0
    );

    const isFirstSubmission = (sumData ?? []).length === 0;

    // Calculate credits to grant
    let creditsToGrant: number;
    if (totalCreditsGranted >= FEEDBACK_CREDIT_CAP) {
      creditsToGrant = 0;
    } else {
      const earned = isFirstSubmission ? FIRST_SUBMISSION_CREDITS : SUBSEQUENT_CREDITS;
      creditsToGrant = Math.min(earned, FEEDBACK_CREDIT_CAP - totalCreditsGranted);
    }

    // Insert feedback record
    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: userId,
      rating: rating ?? null,
      comment: comment ?? null,
      credits_granted: creditsToGrant,
      profile_viewed: profileViewed ?? null,
      source,
    });

    if (insertError) {
      console.error('Error inserting feedback:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save feedback' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Grant credits if applicable
    if (creditsToGrant > 0) {
      const { error: rpcError } = await supabase.rpc('increment_credits', {
        p_user_id: userId,
        p_amount: creditsToGrant,
      });

      if (rpcError) {
        console.error('Error granting credits:', rpcError);
        // Feedback is already saved — log the error but don't fail the response
      }
    }

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
