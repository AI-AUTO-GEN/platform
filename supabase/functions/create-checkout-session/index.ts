import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: corsHeaders });
    }

    const { amount } = await req.json(); // amount in cents
    if (!amount || amount < 500) { // minimum $5
      return new Response(JSON.stringify({ error: 'Minimum amount is $5.00' }), { status: 400, headers: corsHeaders });
    }

    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers: corsHeaders });
    }

    const stripe = new Stripe(STRIPE_SECRET, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Renderfarm Credits',
            description: `$${(amount / 100).toFixed(2)} in rendering credits`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      client_reference_id: user.id,
      success_url: `${req.headers.get('origin') || 'https://ai-renderfarm.surge.sh'}?payment=success`,
      cancel_url: `${req.headers.get('origin') || 'https://ai-renderfarm.surge.sh'}?payment=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
