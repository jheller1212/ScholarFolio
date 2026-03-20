import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@14.14.0";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

const PACKS: Record<string, { credits: number; priceInCents: number; name: string }> = {
  starter: { credits: 20, priceInCents: 500, name: 'Starter — 20 searches' },
  pro: { credits: 50, priceInCents: 1000, name: 'Pro — 50 searches' },
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

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

    const { packId } = await req.json();
    const pack = PACKS[packId];

    if (!pack) {
      return new Response(
        JSON.stringify({ error: 'Invalid pack' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `ScholarFolio ${pack.name}`,
            description: `${pack.credits} scholar profile searches`,
          },
          unit_amount: pack.priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${ALLOWED_ORIGINS[0]}?payment=success`,
      cancel_url: `${ALLOWED_ORIGINS[0]}?payment=cancelled`,
      metadata: {
        user_id: user.id,
        pack_id: packId,
        credits: String(pack.credits),
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
