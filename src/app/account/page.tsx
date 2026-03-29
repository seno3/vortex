'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Tip } from '@/types';
import { dispatchFlaresChanged } from '@/lib/flareSync';

const SANS = 'var(--font-sans, sans-serif)';
const MONO = 'var(--font-mono, monospace)';

const URGENCY_COLOR: Record<string, string> = {
  low: '#22C55E',
  medium: '#EAB308',
  high: '#F97316',
  critical: '#DC2626',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCoords(lng: number, lat: number): string {
  return `(${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'})`;
}

function SkeletonRow() {
  return (
    <div style={{
      height: 72,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      marginBottom: 8,
      animation: 'skeletonPulse 1.5s ease-in-out infinite',
    }} />
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [backHover, setBackHover] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.push('/'); return; }
      return r.json();
    }).then(data => { if (data) setUser(data); });
  }, [router]);

  useEffect(() => {
    fetch('/api/tips/mine').then(r => r.ok ? r.json() : []).then(data => {
      setTips(Array.isArray(data) ? data : []);
      setTipsLoading(false);
    }).catch(() => setTipsLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSignOut = () => {
    document.cookie = 'vigil_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/');
  };

  const fade = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-4px)',
    transition: `opacity 350ms ${delay}ms ease-out, transform 350ms ${delay}ms ease-out`,
  });

  const initial = user ? user.username[0].toUpperCase() : '?';

  const handleDeleteTip = async (tipId: string) => {
    const res = await fetch(`/api/tips/${tipId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setTips((prev) => prev.filter((t) => t._id !== tipId));
      dispatchFlaresChanged();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: SANS }}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @media (max-width: 560px) {
          .account-identity { flex-direction: column !important; align-items: center !important; text-align: center !important; }
          .account-body { padding: 24px 16px !important; }
        }
        .account-flares-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.2) transparent;
        }
        .account-flares-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .account-flares-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.14);
          border-radius: 4px;
        }
        .account-flares-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>

      {/* Top bar */}
      <div style={{
        ...fade(0),
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        height: 56,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <button
          onClick={() => router.back()}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: backHover ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 150ms ease',
            flexShrink: 0,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginLeft: 4 }}>
          My Account
        </span>
      </div>

      {/* Body */}
      <div
        className="account-body"
        style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}
      >

        {/* Identity card */}
        <div style={fade(80)}>
          <div
            className="account-identity"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: '28px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 400,
              color: '#ffffff',
              fontFamily: SANS,
              flexShrink: 0,
            }}>
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 400, color: 'rgba(255,255,255,0.95)' }}>
                {user?.username ?? '—'}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>
                Credibility score: {user?.credibilityScore ?? '—'}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
                  {user?.tipsSubmitted ?? 0} SUBMITTED
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
                  {user?.tipsCorroborated ?? 0} CORROBORATIONS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* My Tips */}
        <div style={fade(160)}>
          <div style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            MY FLARES
          </div>

          {tipsLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : tips.length === 0 ? (
            <div style={{
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: SANS, fontSize: 13, color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>
                No flares yet
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>
                Tap a building on the map to drop your first flare
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
                {user?.tipsSubmitted ?? tips.length} flare{(user?.tipsSubmitted ?? tips.length) !== 1 ? 's' : ''} submitted
              </div>
              <div
                className="account-flares-scroll"
                style={{
                  maxHeight: 'min(420px, 52vh)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingRight: 6,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {tips.map((tip) => (
                  <TipCard key={tip._id} tip={tip} onDelete={() => handleDeleteTip(tip._id)} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Danger zone */}
        <div style={fade(220)}>
          <div style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            ACCOUNT
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <DangerRow
              label="Sign out"
              onClick={handleSignOut}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TipCard({ tip, onDelete }: { tip: Tip; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const coords = tip.location?.coordinates;
  const [lng, lat] = coords ?? [0, 0];
  const color = URGENCY_COLOR[tip.urgency] ?? '#3B82F6';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        paddingLeft: 22,
        transition: 'background 150ms ease',
        cursor: 'default',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        left: 8,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: 2,
        background: color,
      }} />

      {/* Row 1: building id + urgency badge + time + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tip.buildingId ? `Building ${tip.buildingId.slice(-6)}` : tip.category.replace('_', ' ')}
        </span>
        <span style={{
          fontFamily: MONO,
          fontSize: 9,
          padding: '2px 7px',
          borderRadius: 100,
          background: `${color}22`,
          color,
          border: `1px solid ${color}44`,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {tip.urgency}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          {timeAgo(tip.createdAt)}
        </span>
        <button
          type="button"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            if (deleting) return;
            setDeleting(true);
            Promise.resolve(onDelete()).finally(() => setDeleting(false));
          }}
          style={{
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            color: 'rgba(248,113,113,0.95)',
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: deleting ? 'wait' : 'pointer',
            opacity: deleting ? 0.6 : 1,
          }}
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>

      {/* Row 2: description */}
      <div style={{
        fontFamily: 'var(--font-sans, sans-serif)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {tip.description}
      </div>

      {/* Row 3: coordinates */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.03em' }}>
        {formatCoords(lng, lat)}
      </div>
    </div>
  );
}

function DangerRow({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 52,
        padding: '0 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: hover ? 'rgba(239,68,68,0.06)' : 'transparent',
        transition: 'background 120ms ease',
        cursor: 'pointer',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1={21} y1={12} x2={9} y2={12} />
      </svg>
      <span style={{ fontFamily: SANS, fontSize: 13, color: 'rgba(239,68,68,0.8)' }}>{label}</span>
    </div>
  );
}
