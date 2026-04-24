// ─── LogMonitor Component ────────────────────────
// Real-time log feed from Supabase renderfarm_logs

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function LogMonitor() {
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('IDLE')

  useEffect(() => {
    let hideTimeout;
    let completeTimeout;
    const channel = supabase.channel('logs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'renderfarm_logs' }, p => {
        setLogs([p.new]);
        setStatus('PROCESSING');
        clearTimeout(hideTimeout);
        clearTimeout(completeTimeout);
        completeTimeout = setTimeout(() => {
            setStatus('COMPLETED');
            hideTimeout = setTimeout(() => setStatus('IDLE'), 2000);
        }, 5000);
    }).subscribe()
    return () => {
        supabase.removeChannel(channel);
        clearTimeout(hideTimeout);
        clearTimeout(completeTimeout);
    }
  }, [])

  if (status === 'IDLE') return null;

  return (
    <div className={`sidebar-log-monitor ${status.toLowerCase()}`}>
       <div className="sidebar-log-header">
           <div className={status === 'PROCESSING' ? "status-dot-pulse" : "status-dot-static"}></div>
           <span>{status}</span>
       </div>
       {status === 'PROCESSING' && logs.length > 0 && (
         <div className="sidebar-log-message" title={logs[0].message}>
            {logs[0].message.length > 40 ? logs[0].message.substring(0,40) + '...' : logs[0].message}
         </div>
       )}
    </div>
  )
}
