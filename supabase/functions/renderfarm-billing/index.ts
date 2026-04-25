import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // SECURITY CHECK: Verify that the caller has the correct authorization.
    // N8N must send the Edge Function Secret to call this securely.
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    
    // VULNERABILITY FIXED: No longer falling back to SUPABASE_SERVICE_ROLE_KEY.
    // N8N_WEBHOOK_SECRET must be explicitly set to accept requests.
    if (!expectedSecret || !authHeader || !authHeader.includes(expectedSecret)) {
      console.warn("Unauthorized access attempt to renderfarm-billing");
      return new Response(JSON.stringify({ error: 'Unauthorized or missing secret configuration' }), { status: 401, headers: corsHeaders });
    }

    const { action, user_id, model_id, transaction_id, actual_cost, settings } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action field' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'hold' && !user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id field for hold' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Initialize Supabase client with Service Role to bypass RLS for billing
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'hold') {
      if (!model_id) return new Response(JSON.stringify({ error: 'Missing model_id' }), { status: 400, headers: corsHeaders });

      // 1. Get Model Pricing
      const { data: model, error: modelErr } = await supabase
        .from('ai_models')
        .select('pricing_base, pricing_type')
        .eq('id', model_id)
        .single();
      
      if (modelErr || !model) {
        return new Response(JSON.stringify({ error: 'Model not found' }), { status: 404, headers: corsHeaders });
      }

      let estimatedCost = parseFloat(model.pricing_base || '0');
      // Simple heuristic for duration-based videos if pricing base is not enough
      if (model.pricing_type && model.pricing_type.includes('duration') && settings && settings.duration) {
         estimatedCost = estimatedCost * parseFloat(settings.duration);
      }
      // Ensure minimum hold
      if (estimatedCost === 0) estimatedCost = 0.05; // Fallback

      // 2. Call Atomic Hold RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('wallet_hold', {
        p_user_id: user_id,
        p_amount: estimatedCost,
        p_model_id: model_id
      });

      if (rpcErr || (rpcData && rpcData.error)) {
        console.error("Hold failed:", rpcErr || rpcData?.error);
        return new Response(JSON.stringify({ error: rpcData?.error || 'Failed to hold funds' }), { status: 402, headers: corsHeaders });
      }

      return new Response(JSON.stringify(rpcData), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'liquidate' || action === 'refund') {
      if (!transaction_id) return new Response(JSON.stringify({ error: 'Missing transaction_id' }), { status: 400, headers: corsHeaders });

      let rpcData, rpcErr;

      if (action === 'liquidate') {
        let finalCharge = parseFloat(actual_cost || '0');
        if (isNaN(finalCharge) || finalCharge <= 0) {
           // Fallback to reading the hold amount if no actual cost is provided
           const { data: holdTx } = await supabase.from('wallet_transactions').select('amount').eq('id', transaction_id).single();
           finalCharge = holdTx ? Math.abs(holdTx.amount) : 0;
        }

        const res = await supabase.rpc('wallet_liquidate', {
          p_tx_id: transaction_id,
          p_actual_cost: finalCharge
        });
        rpcData = res.data;
        rpcErr = res.error;
      } else if (action === 'refund') {
        const res = await supabase.rpc('wallet_refund', {
          p_tx_id: transaction_id
        });
        rpcData = res.data;
        rpcErr = res.error;
      }

      if (rpcErr || (rpcData && rpcData.error)) {
        console.error(`${action} failed:`, rpcErr || rpcData?.error);
        return new Response(JSON.stringify({ error: rpcData?.error || `Failed to ${action}` }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify(rpcData), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("Edge Function Exception:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
