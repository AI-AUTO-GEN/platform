import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, Zap } from 'lucide-react';

export function WalletWidget({ session }) {
  const [balance, setBalance] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('profile_id', session.user.id)
        .single();
      if (data) setBalance(data.balance);
    } catch (e) {
      console.error("Error fetching balance:", e);
    }
  }, [session]);

  useEffect(() => {
    fetchBalance();
    if (!session?.user?.id) return;
    
    // VULNERABILITY FIXED: Replaced expensive setInterval polling with WebSocket realtime subscription
    const channel = supabase.channel('wallet_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_wallets', filter: `profile_id=eq.${session.user.id}` }, (payload) => {
        setBalance(payload.new.balance);
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [fetchBalance, session]);

  if (balance === null) return <div className="wallet-widget loading"><span className="pulse-dot"></span></div>;

  return (
    <>
      <button className="wallet-widget glass" onClick={() => setShowModal(true)}>
        <Wallet size={16} className="lucide-icon text-accent" />
        <span className="wallet-balance">${balance.toFixed(2)}</span>
        <div className="wallet-add-btn"><Plus size={14} /></div>
      </button>

      {showModal && <WalletModal session={session} balance={balance} onClose={() => setShowModal(false)} onRefresh={fetchBalance} />}
    </>
  );
}

function WalletModal({ session, balance, onClose, onRefresh }) {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('add'); // 'add' or 'history'

  useEffect(() => {
    if (view === 'history') fetchTransactions();
  }, [view]);

  const fetchTransactions = async () => {
    try {
      const { data: wallet } = await supabase.from('user_wallets').select('id').eq('profile_id', session.user.id).single();
      if (!wallet) return;
      
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) setTransactions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFunds = async () => {
    if (amount <= 0) return;
    setLoading(true);
    try {
      // VULNERABILITY FIXED: Blocked client-side RPC dev_add_funds call.
      // A genuine integration with Stripe via secure Edge Functions is required.
      alert("SECURITY BLOCK: Direct funding via client RPC 'dev_add_funds' is disabled to prevent infinite money exploits.");
    } catch (e) {
      alert("Error adding funds: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="wallet-modal glass-panel slide-up" onClick={e => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <div className="wm-header-left">
            <div className="wm-icon-box"><Wallet size={24} /></div>
            <div>
              <h2>Billing & Credits</h2>
              <p className="tiny-label">Manage your workspace balance</p>
            </div>
          </div>
          <button className="icon-btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="wallet-balance-hero">
          <span className="tiny-label uppercase tracking-widest">Current Balance</span>
          <h1 className="gradient-text">${balance.toFixed(2)}</h1>
        </div>

        <div className="wallet-tabs">
          <button className={`w-tab ${view === 'add' ? 'active' : ''}`} onClick={() => setView('add')}>Add Funds</button>
          <button className={`w-tab ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>Transaction History</button>
        </div>

        <div className="wallet-modal-body">
          {view === 'add' && (
            <div className="add-funds-view">
              <p className="view-desc">Select an amount to recharge your Renderfarm wallet. Credits are consumed dynamically during inference.</p>
              
              <div className="amount-grid">
                {[10, 25, 50, 100].map(val => (
                  <button 
                    key={val} 
                    className={`amount-card ${amount === val ? 'selected' : ''}`}
                    onClick={() => setAmount(val)}
                  >
                    <h3>${val}</h3>
                    <span className="tiny-label">+ {val * 10} Credits</span>
                  </button>
                ))}
              </div>

              <div className="custom-amount-row">
                <span className="tiny-label">Custom Amount</span>
                <div className="custom-amount-input">
                  <span>$</span>
                  <input type="number" min="5" value={amount} onChange={e => setAmount(Number(e.target.value))} />
                </div>
              </div>

              <button className={`btn-primary w-full mt-4 ${loading ? 'spinning' : ''}`} onClick={handleAddFunds} disabled={loading || amount < 5}>
                {loading ? 'Processing...' : `Pay $${amount.toFixed(2)} with Stripe`}
              </button>
              <p className="tiny-info text-center mt-2 opacity-50">Stripe checkout is simulated in Dev mode.</p>
            </div>
          )}

          {view === 'history' && (
            <div className="history-view">
              {transactions.length === 0 ? (
                <div className="empty-history text-center p-8 opacity-50">No transactions found.</div>
              ) : (
                <div className="tx-list">
                  {transactions.map(tx => (
                    <div key={tx.id} className="tx-item">
                      <div className={`tx-icon ${tx.type}`}>
                        {tx.type === 'deposit' ? <ArrowDownLeft size={16} /> : 
                         tx.type === 'withdrawal' ? <ArrowUpRight size={16} /> : 
                         tx.type === 'hold' ? <Clock size={16} /> : <Zap size={16} />}
                      </div>
                      <div className="tx-details">
                        <span className="tx-desc">{tx.description}</span>
                        <span className="tx-date">{new Date(tx.created_at).toLocaleString()}</span>
                      </div>
                      <div className={`tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                        {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
