// ─── LogMonitor Component ────────────────────────
// P55 FIX: No longer creates its own Supabase channel.
// Receives lastLog as a prop from App.jsx's single subscription.

import { useState, useEffect, useRef } from 'react'

export default function LogMonitor({ lastLog }) {
  const [status, setStatus] = useState('IDLE')
  const [displayLog, setDisplayLog] = useState(null)
  const hideRef = useRef(null)
  const completeRef = useRef(null)

  useEffect(() => {
    if (!lastLog) return
    setDisplayLog(lastLog)
    setStatus('PROCESSING')
    clearTimeout(hideRef.current)
    clearTimeout(completeRef.current)
    completeRef.current = setTimeout(() => {
      setStatus('COMPLETED')
      hideRef.current = setTimeout(() => setStatus('IDLE'), 2000)
    }, 5000)
    return () => {
      clearTimeout(hideRef.current)
      clearTimeout(completeRef.current)
    }
  }, [lastLog])

  if (status === 'IDLE') return null;

  return (
    <div className={`sidebar-log-monitor ${status.toLowerCase()}`}>
       <div className="sidebar-log-header">
           <div className={status === 'PROCESSING' ? "status-dot-pulse" : "status-dot-static"}></div>
           <span>{status}</span>
       </div>
       {status === 'PROCESSING' && displayLog && (
         <div className="sidebar-log-message" title={displayLog.message}>
            {displayLog.message?.length > 40 ? displayLog.message.substring(0,40) + '...' : displayLog.message}
         </div>
       )}
    </div>
  )
}
