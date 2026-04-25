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
      // P07 FIX: Use direct aggregate query instead of non-existent RPC
      const { data } = await supabase
        .from('drive_media')
        .select('file_size')
        .eq('profile_id', session.user.id)
      if (data) setQuotaUsed(data.reduce((sum, row) => sum + (row.file_size || 0), 0))
    } catch (e) {
      // Silently handle — quota display is non-critical
    }
  }, [session])

  useEffect(() => {
    fetchQuota();
    // VULNERABILITY FIXED: Removed 30s setInterval polling for quota to prevent DDoSO.
  }, [fetchQuota])

  const handleClearData = async () => {
    // VULNERABILITY FIXED: Blocked dangerous client RPC that wipes DB but leaves Drive files immortal.
    alert("SECURITY BLOCK: Deleting all user data from client is disabled because it orphans files in Google Drive. This requires a secure backend webhook.");
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
