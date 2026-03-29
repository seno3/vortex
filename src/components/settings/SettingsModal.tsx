'use client';

import { useState } from 'react';
import FlareRadiusSettings from './FlareRadiusSettings';
import { usePreferredUnit } from '@/hooks/usePreferredUnit';

const FONT = 'var(--font-sans, sans-serif)';

function IconMapPin() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx={12} cy={9} r={2.5} />
    </svg>
  );
}

function SettingsRow({
  icon,
  label,
  right,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        background: hover && onClick ? 'rgba(255,255,255,0.06)' : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      {icon}
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
        {label}
      </span>
      {right}
    </div>
  );
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { unit, toggle } = usePreferredUnit();

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,0.45)' }}
      />
      <div
        style={{
          position: 'fixed',
          top: 56,
          right: 16,
          zIndex: 60,
          width: 'min(300px, calc(100vw - 32px))',
          maxHeight: 'min(520px, calc(100dvh - 72px))',
          overflowY: 'auto',
          background: 'rgba(10,10,10,0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          padding: '14px 8px 18px',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 10px' }}>
          <span style={{ fontSize: 12, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 6 }}>
          <SettingsRow
            icon={<IconMapPin />}
            label="Preferred units"
            onClick={toggle}
            right={
              <span
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                {unit}
              </span>
            }
          />
          <FlareRadiusSettings />
        </div>
      </div>
    </>
  );
}
