'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';

interface ProfilePanelProps {
  user: User;
  onClose: () => void;
  onSignOut: () => void;
}

const FONT = 'var(--font-sans, sans-serif)';
const NOTIF_KEY = 'vigil_notifications';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUser() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12} y2={8} strokeWidth={2} />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1={21} y1={12} x2={9} y2={12} />
    </svg>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  labelColor = 'rgba(255,255,255,0.75)',
  hoverBg = 'rgba(255,255,255,0.06)',
  right,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  hoverBg?: string;
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
        background: hover && onClick ? hoverBg : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      {icon}
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: 400, color: labelColor }}>
        {label}
      </span>
      {right}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function ProfilePanel({ user, onClose, onSignOut }: ProfilePanelProps) {
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(NOTIF_KEY) === 'true';
  });

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem(NOTIF_KEY, String(next));
  };

  const close = () => {
    setClosing(true);
    setTimeout(() => { onClose(); }, 140);
  };

  const handleSignOut = () => {
    document.cookie = 'vigil_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    close();
    setTimeout(() => onSignOut(), 140);
  };

  const initial = user.username[0].toUpperCase();

  return (
    <>
      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, zIndex: 49 }}
      />

      {/* Panel */}
      <div
        className="vigil-profile-panel"
        style={{
          position: 'fixed',
          top: 56,
          right: 16,
          width: 260,
          zIndex: 50,
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          animation: `${closing ? 'panelOut 140ms ease-in' : 'panelIn 180ms ease-out'} both`,
        }}
      >
        {/* Section 1 — Identity */}
        <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500, color: '#fff', fontFamily: FONT, marginBottom: 12 }}>
            {initial}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
            {user.username}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Credibility score: {user.credibilityScore}
          </div>
        </div>

        {/* Section 2 — Settings */}
        <div style={{ padding: 8 }}>
          <Row
            icon={<IconUser />}
            label="My Account"
            onClick={() => { close(); setTimeout(() => router.push('/account'), 140); }}
          />
          <Row
            icon={<IconBell />}
            label="Notifications"
            onClick={toggleNotifications}
            right={
              <div
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 100,
                  background: notificationsEnabled ? '#3B82F6' : 'rgba(255,255,255,0.12)',
                  transition: 'background 200ms ease',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 3,
                  left: notificationsEnabled ? 17 : 3,
                  transition: 'left 200ms ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            }
          />
        </div>

        <div style={{ padding: 8 }}>
          <Row icon={<IconShield />} label="Privacy" />
          <Row icon={<IconInfo />} label="About Vigil" />
        </div>

        {/* Section 3 — Sign out */}
        <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Row
            icon={<IconSignOut />}
            label="Sign out"
            labelColor="rgba(239,68,68,0.8)"
            hoverBg="rgba(239,68,68,0.08)"
            onClick={handleSignOut}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 400px) {
          .vigil-profile-panel { right: 8px !important; left: 8px !important; width: auto !important; }
        }
      `}</style>
    </>
  );
}
