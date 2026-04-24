// ─── AlchemyProgress Component ────────────────────────
// Animated progress ring for generation status

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function AlchemyProgress({ status, realProgress, statusMessage }) {
  const [percent, setPercent] = useState(0)
  
  useEffect(() => {
    if (status === 'error') {
      setPercent(0);
    } else if (status === 'processing' && !realProgress) {
      const interval = setInterval(() => {
        setPercent(prev => {
          if (prev < 92) return prev + Math.random() * 2;
          return prev;
        });
      }, 800);
      return () => clearInterval(interval);
    } else if (status === 'ready' && percent !== 100) {
      setPercent(100);
    } else if (status !== 'ready' && realProgress !== undefined && percent !== realProgress) {
      setPercent(realProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, realProgress])

  if (status === 'error') {
    return (
      <div className="alchemy-progress-ring alchemy-error">
        <div className="progress-value mono" style={{color:'#ff4444',fontSize:'1.4rem'}}><X size={16} className="lucide-icon" /></div>
        <div className="progress-label tiny-label" style={{color:'#ff6b6b'}}>{statusMessage || 'Generation failed'}</div>
      </div>
    )
  }

  if ((status !== 'processing' && status !== 'ready' && !realProgress) || (status === 'ready' && percent === 100)) return null;

  return (
    <div className="alchemy-progress-ring">
      <div className="progress-value mono">{Math.floor(realProgress || percent)}%</div>
      <div className="progress-label tiny-label">{statusMessage || 'TRANSFORMING REALITY'}</div>
    </div>
  )
}
