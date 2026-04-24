import { useEffect } from 'react';

export default function useGlobalTactile() {
  useEffect(() => {
    let pressedElement = null;

    const updateMask = (e, el) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const baseRadius = Math.max(30, Math.min(rect.width, rect.height) / 1.5);
      const holeRadius = baseRadius + 120;
      
      el.style.setProperty('--mask', `radial-gradient(circle ${holeRadius}px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.4) 40%, black 100%)`);
    };

    const handleMouseDown = (e) => {
      // Find the closest interactive element
      const el = e.target.closest('.tactile, button, .btn, .card, .popover, .task-card, .enhance-menu, .audio-viz-card, .entity-task-card, .action-card, .nav-project-badge');
      if (el) {
        pressedElement = el;
        // Make sure it has the tactile class if it's dynamically targeted
        if (!el.classList.contains('tactile')) {
           el.classList.add('tactile');
        }
        updateMask(e, el);
      }
    };

    const handleMouseMove = (e) => {
      if (pressedElement) {
        updateMask(e, pressedElement);
      } else {
        // Hover effect for unpressed? We can skip for performance, but V8 had none.
      }
    };

    const handleMouseUp = () => {
      if (pressedElement) {
        pressedElement.style.setProperty('--mask', 'linear-gradient(black, black)');
        pressedElement = null;
      }
    };

    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    
    // Additional cleanup for drag leaves
    document.addEventListener('dragend', handleMouseUp, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dragend', handleMouseUp);
    };
  }, []);
}

