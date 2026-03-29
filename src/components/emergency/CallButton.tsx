'use client';
import { useState } from 'react';

export default function CallButton() {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse ring */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '100px',
        border: '2px solid rgba(220,38,38,0.5)',
        animation: 'emergCallPulse 1.8s ease-out infinite',
        pointerEvents: 'none',
      }} />

      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setActive(false); }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        onClick={() => window.open('tel:911')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 28px',
          borderRadius: '100px',
          background: hovered ? '#EF4444' : '#DC2626',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#ffffff',
          fontSize: '12px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-sans, sans-serif)',
          cursor: 'pointer',
          transform: active ? 'scale(0.97)' : hovered ? 'scale(1.03)' : 'scale(1)',
          transition: 'background 150ms ease, transform 150ms ease',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Phone icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
        </svg>
        Call 911
      </button>
    </div>
  );
}
