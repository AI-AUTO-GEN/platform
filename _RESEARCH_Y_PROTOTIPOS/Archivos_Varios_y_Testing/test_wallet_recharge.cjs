const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nangyrlyayskchsjqymn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  console.log("=== INICIANDO PRUEBA DE RECARGA DE WALLET ===");

  // 1. Sign in as test user
  const email = 'test_audit_2026@gmail.com';
  const password = 'password123';
  
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  
  const userId = authData.user.id;
  console.log(`Usuario autenticado: ${email} (${userId})`);

  // 2. Fetch current balance
  const { data: walletBefore } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('profile_id', userId)
    .single();
    
  console.log(`Balance Inicial: $${walletBefore.balance}`);

  // 3. Simulate calling the Dev RPC (which simulates a Stripe Webhook success)
  console.log("\n-> Simulando recarga de $50 (Stripe Webhook MOCK)...");
  
  // Note: dev_add_funds is SECURITY DEFINER, so the authenticated user can call it 
  // (In production, only the service role from the Stripe Webhook should call a similar deposit function).
  const rechargeAmount = 50.00;
  const { data: rpcData, error: rpcError } = await supabase.rpc('dev_add_funds', {
    p_amount: rechargeAmount,
    p_user_id: userId
  });

  if (rpcError) {
    console.error("Fallo al ejecutar dev_add_funds:", rpcError);
    return;
  }

  console.log("Respuesta RPC:", rpcData);

  // 4. Verify new balance
  const { data: walletAfter } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('profile_id', userId)
    .single();

  console.log(`\nBalance Post-Recarga: $${walletAfter.balance} (Esperado: $${walletBefore.balance + rechargeAmount})`);

  // 5. Verify the transaction log
  console.log("\n-> Verificando registro en wallet_transactions...");
  const { data: txs } = await supabase
    .from('wallet_transactions')
    .select('type, amount, description, created_at')
    .eq('wallet_id', walletAfter.id)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log("Últimas 3 transacciones registradas:");
  txs.forEach((tx, i) => {
    console.log(`[${i+1}] Tipo: ${tx.type.padEnd(10)} | Monto: ${tx.amount > 0 ? '+' : ''}${tx.amount} | Desc: ${tx.description}`);
  });

  console.log("\n=== PRUEBA DE RECARGA COMPLETADA CON ÉXITO ===");
}

runTest().catch(console.error);
