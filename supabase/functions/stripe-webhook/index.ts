import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature provided', { status: 400 });
    }

    const body = await req.text();
    let event;

    try {
      const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
      if (!endpointSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
      
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Initialize Supabase Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Ensure payment was successful
      if (session.payment_status === 'paid') {
        const userId = session.client_reference_id; // Passed when creating checkout session
        const amountPaidInCents = session.amount_total;
        const stripeTxId = session.payment_intent || session.id;

        if (!userId) {
          console.error(`No client_reference_id attached to session ${session.id}`);
          return new Response('Ignored: Missing client_reference_id', { status: 200 });
        }

        const amountInDollars = amountPaidInCents / 100;

        // Process atomic deposit via RPC
        const { data: rpcData, error: rpcErr } = await supabase.rpc('wallet_deposit', {
          p_user_id: userId,
          p_amount: amountInDollars,
          p_stripe_tx_id: stripeTxId
        });

        if (rpcErr || (rpcData && rpcData.error)) {
          console.error("Deposit failed:", rpcErr || rpcData?.error);
          return new Response(JSON.stringify({ error: rpcData?.error || 'Deposit failed' }), { status: 500 });
        }

        console.log(`Successfully deposited $${amountInDollars} to user ${userId}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Stripe Webhook Exception:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
