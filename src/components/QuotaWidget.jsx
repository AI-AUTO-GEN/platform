// ─── QuotaWidget Component ────────────────────────
// Storage quota bar with clear data action

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabase'
import { customConfirm } from '../utils/assetUtils'

export default function QuotaWidget({ session }) {
  const [quotaUsed, setQuotaUsed] = useState(0)
  const MAX_QUOTA = 500 * 1024 * 1024; // 500 MB
  
  const fetchQuota = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const { data } = await supabase.rpc('get_user_quota', { p_user_id: session.user.id })
      if (data !== null) setQuotaUsed(Number(data))
    } catch (e) {
      // RPC may not exist yet — silently ignore
    }
  }, [session])

  useEffect(() => {
    fetchQuota();
    const iv = setInterval(fetchQuota, 30000);
    return () => clearInterval(iv);
  }, [fetchQuota])

  const handleClearData = async () => {
    customConfirm("You are about to delete ALL your generate files and history from Supabase. Make sure you have downloaded everything via the '📦 ZIP Production' button if needed. Proceed?", async () => {
      await supabase.rpc('delete_user_data')
      setQuotaUsed(0)
      window.location.reload()
    })
  }

  const percent = Math.min((quotaUsed / MAX_QUOTA) * 100, 100);
  const color = percent > 90 ? '#ff4040' : percent > 75 ? '#ffcc00' : 'var(--accent)';

  return (
    <div className="quota-widget" title={`${(quotaUsed/1024/1024).toFixed(1)} MB / 500 MB Used`}>
      <div className="quota-bar-bg">
         <div className="quota-bar-fill" style={{ width: `${percent}%`, backgroundColor: color }}></div>
      </div>
      {percent >= 90 && (
         <button className="btn-clear-alert" onClick={handleClearData}>Storage Full! Clear Data &rarr;</button>
      )}
    </div>
  )
}
