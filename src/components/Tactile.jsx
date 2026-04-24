import React, { useRef, useState, useEffect } from 'react';

export default function Tactile({ 
  children, 
  className = '', 
  style = {}, 
  bg = 'var(--silicone-base)', 
  shadowOut, 
  shadowIn,
  ...props 
}) {
  const elRef = useRef(null);
  const [isPressed, setIsPressed] = useState(false);

  // Expose CSS variables to the tactile CSS engine
  const customStyle = {
    ...style,
    '--t-bg': bg,
    ...(shadowOut ? { '--t-shadow-out': shadowOut } : {}),
    ...(shadowIn ? { '--t-shadow-in': shadowIn } : {})
  };

  const updateMask = (e) => {
    if (!elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Base radius + the previous max growth (120) instantly
    const holeRadius = Math.max(30, Math.min(rect.width, rect.height) / 1.5) + 120;
    
    const mask = `radial-gradient(circle ${holeRadius}px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.4) 40%, black 100%)`;
    elRef.current.style.setProperty('--mask', mask);
  };

  const handleMouseDown = (e) => {
    setIsPressed(true);
    updateMask(e);
  };

  const handleMouseMove = (e) => {
    if (!isPressed) return;
    updateMask(e);
  };

  const handleRelease = () => {
    if (!isPressed) return;
    setIsPressed(false);
    if (elRef.current) {
      elRef.current.style.setProperty('--mask', 'linear-gradient(black, black)');
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPressed) handleRelease();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPressed]);

  return (
    <div 
      ref={elRef}
      className={`tactile ${className}`}
      style={customStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      {...props}
    >
      {children}
    </div>
  );
}
