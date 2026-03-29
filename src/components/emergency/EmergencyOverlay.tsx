'use client';
import { useEffect, useState } from 'react';
import type { Emergency } from '@/types';
import CallButton from './CallButton';
import EmergencyBadge from './EmergencyBadge';
import EmergencyFeed from './EmergencyFeed';

const KEYFRAMES = `
@keyframes emergCallPulse {
  from { transform: scale(1);   opacity: 0.5; }
  to   { transform: scale(1.08); opacity: 0;   }
}
@keyframes emergDotPulse {
  from { transform: scale(1);   opacity: 0.5; }
  to   { transform: scale(1.08); opacity: 0;   }
}
@keyframes emergRingExpand {
  from { transform: translate(-50%,-50%) scale(1);   opacity: 0.6; }
  to   { transform: translate(-50%,-50%) scale(2.5); opacity: 0;   }
}
@keyframes emergSlideIn {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes emergFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
/* Hide epicenter chips on mobile */
@media (max-width: 767px) {
  .epicenter-chips { display: none !important; }
}
/* Mobile corner adjustments */
@media (max-width: 767px) {
  .emerg-bl { bottom: 20px !important; left: 16px !important; }
  .emerg-tr { top: 20px !important;    right: 16px !important; }
  .emerg-br { bottom: 20px !important; right: 16px !important; }
  .emerg-bc { bottom: 20px !important; }
}
`;

interface EmergencyOverlayProps {
  emergency: Emergency;
  visible: boolean;
}

export default function EmergencyOverlay({ emergency, visible }: EmergencyOverlayProps) {
  const [opacity, setOpacity] = useState(0);

  // Entry: animate to 1 after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Exit: animate to 0 when visible=false
  useEffect(() => {
    if (!visible) setOpacity(0);
  }, [visible]);

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Shell — full screen, pointer-events: none so map remains interactive */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'none',
        opacity,
        transition: visible ? 'opacity 300ms ease-out' : 'opacity 400ms ease-out',
      }}>
        {/* Vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 101,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
        }} />

        {/* Bottom-left — Call Button */}
        <div className="emerg-bl" style={{
          position: 'absolute', bottom: 32, left: 32, zIndex: 102, pointerEvents: 'auto',
        }}>
          <CallButton />
        </div>

        {/* Top-right — Emergency Badge */}
        <div className="emerg-tr" style={{
          position: 'absolute', top: 24, right: 24, zIndex: 102, pointerEvents: 'auto',
        }}>
          <EmergencyBadge emergency={emergency} />
        </div>

        {/* Bottom-right — Live Feed */}
        <div className="emerg-br" style={{
          position: 'absolute', bottom: 32, right: 24, zIndex: 102, pointerEvents: 'auto',
        }}>
          <EmergencyFeed emergency={emergency} />
        </div>

      </div>
    </>
  );
}
