const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nangyrlyayskchsjqymn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0';

const N8N_WEBHOOK_URL = 'https://nsk404.app.n8n.cloud/webhook/ai-renderfarm';

async function run() {
  // Read anon key from .env
  let anonKey = SUPABASE_ANON_KEY;

  const supabase = createClient(SUPABASE_URL, anonKey);

  // 1. Sign in
  const email = 'test_audit_2026@gmail.com';
  const password = 'password123';
  
  console.log('Signing in user:', email);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authErr) throw new Error('Auth error: ' + authErr.message);
  
  const token = authData.session.access_token;
  const user_id = authData.user.id;
  console.log('User signed in:', user_id);

  // 2. Wait a moment for triggers to create wallet
  await new Promise(r => setTimeout(r, 2000));

  // Verify wallet
  const { data: wallet } = await supabase.from('user_wallets').select('*').eq('profile_id', user_id).single();
  console.log('Wallet state before:', wallet);

  // 3. Create mock record in renderfarm_outputs so N8N has something to update
  const { data: row, error: insertErr } = await supabase.from('renderfarm_outputs').insert({
    profile_id: user_id,
    status: 'queue'
  }).select().single();

  if (insertErr) throw new Error('Insert error: ' + JSON.stringify(insertErr));

  console.log('Created row in renderfarm_outputs:', row.id);

  // 4. Fire Webhook
  const payload = {
    action: 'generate',
    project: { title: 'TEST_PROJECT' },
    task: {
      id: 'test-task-1',
      row_id: row.id,
      prompt: 'A cyberpunk cat drinking coffee',
      modelId: 'fal-ai/flux/schnell',
      kind: 't2i',
      settings: {},
      user_id: user_id,
      ref_image: null,
      ref_images: []
    }
  };

  console.log('Firing N8N Webhook...');
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error('Webhook failed:', await res.text());
  } else {
    console.log('Webhook triggered successfully!');
    console.log('Waiting for N8N to process (10s)...');
    await new Promise(r => setTimeout(r, 10000));

    // 5. Check Final Results
    const { data: finalRow } = await supabase.from('renderfarm_outputs').select('*').eq('id', row.id).single();
    console.log('\\n--- FINAL ROW ---');
    console.log('Status:', finalRow.status);
    console.log('URL:', finalRow.generated_url);
    console.log('Usage:', finalRow.usage);

    const { data: finalWallet } = await supabase.from('user_wallets').select('*').eq('profile_id', user_id).single();
    console.log('\\n--- FINAL WALLET ---');
    console.log('Balance:', finalWallet.balance);

    const { data: txs } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', finalWallet.id);
    console.log('\\n--- TRANSACTIONS ---');
    txs.forEach(tx => console.log(`${tx.type}: ${tx.amount} (${tx.description})`));
  }
}

run().catch(console.error);
