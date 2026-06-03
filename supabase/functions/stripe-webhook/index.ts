import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@14.14.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
      return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const packId = session.metadata?.pack_id;
      const credits = parseInt(session.metadata?.credits || '0');

      if (!userId || !credits) {
        console.error('Missing metadata in checkout session');
        return new Response('Missing metadata', { status: 400 });
      }

      console.log(`[Webhook] Adding ${credits} credits for user ${userId} (pack: ${packId})`);

      // Idempotency check: skip if this session was already processed
      const { data: existing } = await supabase
        .from('credit_purchases')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      if (existing) {
        console.log(`[Webhook] Session ${session.id} already processed, skipping`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Record the purchase
      const { error: insertError } = await supabase.from('credit_purchases').insert({
        user_id: userId,
        stripe_session_id: session.id,
        pack: packId,
        credits,
        amount_cents: session.amount_total || 0,
      });

      if (insertError) {
        // UNIQUE constraint violation = duplicate, safe to ignore
        console.log(`[Webhook] Insert failed (likely duplicate): ${insertError.message}`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Atomically add credits (handles upsert internally)
      await supabase.rpc('increment_credits', { p_user_id: userId, p_amount: credits });

      console.log(`[Webhook] Successfully added ${credits} credits for user ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
});
