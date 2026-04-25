import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════
   P74: ACCOUNT PAGES
   - AccountSettings (profile, delete account)
   - PaymentsBilling (wallet, transactions, add funds)
   - ChangePassword
   ═══════════════════════════════════════════════ */

export default function AccountPages({ session, page, onBack }) {
  switch (page) {
    case 'settings': return <AccountSettings session={session} onBack={onBack} />;
    case 'payments': return <PaymentsBilling session={session} onBack={onBack} />;
    case 'password': return <ChangePassword session={session} onBack={onBack} />;
    default: return null;
  }
}

/* ─── PAGE HEADER ─── */
function PageHeader({ title, subtitle, onBack }) {
  return (
    <div className="acctpage-header">
      <button className="acctpage-back" onClick={onBack}>
        <span>←</span> Back
      </button>
      <div>
        <h1 className="acctpage-title">{title}</h1>
        <p className="acctpage-sub">{subtitle}</p>
      </div>
    </div>
  );
}

/* ─── SECTION CARD ─── */
function Section({ title, children, danger }) {
  return (
    <div className={`acctpage-section${danger ? ' danger' : ''}`}>
      {title && <h3 className="acctpage-section-title">{title}</h3>}
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════
   1. ACCOUNT SETTINGS
   ════════════════════════════════════════════════ */
function AccountSettings({ session, onBack }) {
  const user = session.user;
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });
      if (error) throw error;
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      // Sign out first — actual deletion requires admin/edge function
      toast('Account deletion requested. Contact support to finalize.', { icon: '📧' });
      await supabase.auth.signOut();
    } catch (e) {
      toast.error(e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="acctpage">
      <PageHeader title="Account Settings" subtitle="Manage your profile and preferences" onBack={onBack} />

      <div className="acctpage-body">
        <Section title="Profile Information">
          <div className="acctpage-avatar-row">
            <div className="acctpage-avatar-big">{user.email?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <div className="acctpage-label">Email</div>
              <div className="acctpage-value">{user.email}</div>
              <div className="acctpage-label" style={{ marginTop: 8 }}>Member since</div>
              <div className="acctpage-value">{memberSince}</div>
            </div>
          </div>

          <div className="acctpage-field-group">
            <label className="acctpage-label">Display Name</label>
            <input
              className="field"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <button className="btn btn-primary mt-8" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </Section>

        <Section title="Session Information">
          <div className="acctpage-info-grid">
            <div>
              <div className="acctpage-label">User ID</div>
              <div className="acctpage-value mono">{user.id}</div>
            </div>
            <div>
              <div className="acctpage-label">Auth Provider</div>
              <div className="acctpage-value">{user.app_metadata?.provider || 'email'}</div>
            </div>
            <div>
              <div className="acctpage-label">Last Sign In</div>
              <div className="acctpage-value">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
        </Section>

        <Section title="Danger Zone" danger>
          <p className="acctpage-danger-desc">
            Deleting your account is irreversible. All your projects, generations, and wallet balance will be permanently lost.
          </p>
          <div className="acctpage-field-group">
            <label className="acctpage-label">Type <strong>DELETE</strong> to confirm</label>
            <input
              className="field"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <button
            className="btn btn-danger mt-8"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== 'DELETE' || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </Section>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   2. PAYMENTS & BILLING
   ════════════════════════════════════════════════ */
function PaymentsBilling({ session, onBack }) {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [usageStats, setUsageStats] = useState({ totalSpent: 0, totalGens: 0 });

  const fetchBalance = useCallback(async () => {
    const { data } = await supabase
      .from('user_wallets')
      .select('balance')
      .eq('profile_id', session.user.id)
      .single();
    if (data) setBalance(data.balance);
  }, [session]);

  const fetchTransactions = useCallback(async () => {
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('id')
      .eq('profile_id', session.user.id)
      .single();
    if (!wallet) return;
    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) {
      setTransactions(data);
      const spent = data.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const gens = data.filter(t => t.type === 'withdrawal').length;
      setUsageStats({ totalSpent: spent, totalGens: gens });
    }
  }, [session]);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, [fetchBalance, fetchTransactions]);

  const handleAddFunds = async () => {
    if (amount <= 0) return;
    setLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) throw new Error('Not authenticated');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://nangyrlyayskchsjqymn.supabase.co'}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ amount: amount * 100, userId: authSession.user.id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Checkout failed (${res.status})`);
      }
      const { url } = await res.json();
      if (url) window.open(url, '_blank');
      else throw new Error('No checkout URL returned');
    } catch (e) {
      toast.error('Stripe: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="acctpage">
      <PageHeader title="Payments & Billing" subtitle="Manage your balance, add funds, and view transactions" onBack={onBack} />

      <div className="acctpage-body">
        {/* Balance Hero */}
        <Section>
          <div className="pay-balance-hero">
            <div>
              <div className="acctpage-label">Current Balance</div>
              <div className="pay-balance-amount">${balance !== null ? Number(balance).toFixed(2) : '—'}</div>
            </div>
            <div className="pay-stats">
              <div className="pay-stat">
                <span className="pay-stat-val">${usageStats.totalSpent.toFixed(2)}</span>
                <span className="acctpage-label">Total Spent</span>
              </div>
              <div className="pay-stat">
                <span className="pay-stat-val">{usageStats.totalGens}</span>
                <span className="acctpage-label">Generations</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Add Funds */}
        <Section title="Add Funds">
          <div className="pay-amounts">
            {[10, 25, 50, 100].map(val => (
              <button
                key={val}
                className={`pay-amount-card${amount === val ? ' selected' : ''}`}
                onClick={() => setAmount(val)}
              >
                <span className="pay-amount-price">${val}</span>
                <span className="pay-amount-credits">{val * 10} credits</span>
              </button>
            ))}
          </div>

          <div className="pay-custom-row">
            <label className="acctpage-label">Custom Amount</label>
            <div className="pay-custom-input">
              <span>$</span>
              <input type="number" min="5" value={amount} onChange={e => setAmount(Number(e.target.value))} />
            </div>
          </div>

          <button className="btn btn-primary btn-full mt-8" onClick={handleAddFunds} disabled={loading || amount < 5}>
            {loading ? 'Redirecting to Stripe…' : `Pay $${amount.toFixed(2)} with Stripe`}
          </button>
        </Section>

        {/* Transaction History */}
        <Section title="Transaction History">
          {transactions.length === 0 ? (
            <div className="pay-empty">No transactions yet</div>
          ) : (
            <div className="pay-tx-list">
              {transactions.map(tx => (
                <div key={tx.id} className="pay-tx">
                  <div className={`pay-tx-icon ${tx.type}`}>
                    {tx.type === 'deposit' ? '↓' : tx.type === 'withdrawal' ? '↑' : tx.type === 'hold' ? '⏳' : '⚡'}
                  </div>
                  <div className="pay-tx-info">
                    <span className="pay-tx-desc">{tx.description || tx.type}</span>
                    <span className="pay-tx-date">{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                  <span className={`pay-tx-amount ${Number(tx.amount) > 0 ? 'positive' : 'negative'}`}>
                    {Number(tx.amount) > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   3. CHANGE PASSWORD
   ════════════════════════════════════════════════ */
function ChangePassword({ session, onBack }) {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [strength, setStrength] = useState(0);

  const checkStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const handlePasswordChange = (val) => {
    setNewPass(val);
    setStrength(checkStrength(val));
  };

  const handleSubmit = async () => {
    if (newPass.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPass('');
      setConfirmPass('');
      setStrength(0);
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const strengthColors = ['', 'var(--err)', 'var(--warn)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];

  return (
    <div className="acctpage">
      <PageHeader title="Change Password" subtitle="Update your account password" onBack={onBack} />

      <div className="acctpage-body">
        <Section title="New Password">
          <div className="acctpage-field-group">
            <label className="acctpage-label">New Password</label>
            <input
              className="field"
              type="password"
              value={newPass}
              onChange={e => handlePasswordChange(e.target.value)}
              placeholder="Enter new password"
            />
            {newPass && (
              <div className="pw-strength">
                <div className="pw-strength-bar">
                  <div className="pw-strength-fill" style={{ width: `${(strength / 5) * 100}%`, background: strengthColors[strength] }} />
                </div>
                <span className="pw-strength-label" style={{ color: strengthColors[strength] }}>
                  {strengthLabels[strength]}
                </span>
              </div>
            )}
          </div>

          <div className="acctpage-field-group">
            <label className="acctpage-label">Confirm Password</label>
            <input
              className="field"
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder="Confirm new password"
            />
            {confirmPass && confirmPass !== newPass && (
              <span className="pw-mismatch">Passwords do not match</span>
            )}
          </div>

          <button
            className="btn btn-primary mt-8"
            onClick={handleSubmit}
            disabled={saving || newPass.length < 8 || newPass !== confirmPass}
          >
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </Section>

        <Section title="Password Requirements">
          <ul className="pw-requirements">
            <li className={newPass.length >= 8 ? 'met' : ''}>At least 8 characters</li>
            <li className={/[A-Z]/.test(newPass) ? 'met' : ''}>One uppercase letter</li>
            <li className={/[0-9]/.test(newPass) ? 'met' : ''}>One number</li>
            <li className={/[^A-Za-z0-9]/.test(newPass) ? 'met' : ''}>One special character</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
