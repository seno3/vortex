'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Tip, TipCategory, User } from '@/types';
import { formatFlareRadiusShort } from '@/lib/flareRadius';
import CredibilityBadge from './CredibilityBadge';
import ProfilePanel from '@/components/ui/ProfilePanel';

interface NotificationFeedProps {
  lng: number;
  lat: number;
  radius: number;
  user: User | null;
  is3D: boolean;
  onToggle3D: () => void;
  onLocate: () => void;
  onAuthOpen: () => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
}

const FONT = 'var(--font-sans, sans-serif)';
const pill: React.CSSProperties = {
  borderRadius: '999px',
  padding: '4px 12px',
  fontSize: '10px',
  letterSpacing: '0.12em',
  fontFamily: FONT,
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.65)',
  textTransform: 'uppercase',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
};

const SEVERITY_COLORS: Record<string, string> = {
  active_threat: '#ef4444',
  weather: '#3b82f6',
  infrastructure: '#f59e0b',
  general_safety: '#22c55e',
};

const FILTER_TABS: Array<{ label: string; value: TipCategory | 'all' }> = [
  { label: 'ALL', value: 'all' },
  { label: 'THREATS', value: 'active_threat' },
  { label: 'INFRA', value: 'infrastructure' },
  { label: 'WEATHER', value: 'weather' },
  { label: 'SAFETY', value: 'general_safety' },
];

const FILTER_ROW1 = FILTER_TABS.slice(0, 3);
const FILTER_ROW2 = FILTER_TABS.slice(3);

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function NotificationFeed({
  lng,
  lat,
  radius,
  user,
  is3D,
  onToggle3D,
  onLocate,
  onAuthOpen,
  onSignOut,
  onOpenSettings,
}: NotificationFeedProps) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [filter, setFilter] = useState<TipCategory | 'all'>('all');
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);

  const loadTips = useCallback(() => {
    fetch(`/api/tips?lng=${lng}&lat=${lat}&radius=${radius}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setTips)
      .catch(console.error);
  }, [lng, lat, radius]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  const handleUpvote = async (tipId: string) => {
    if (!user || upvotingId) return;
    setUpvotingId(tipId);
    try {
      const res = await fetch(`/api/tips/${tipId}/upvote`, { method: 'POST', credentials: 'include' });
      const text = await res.text();
      let body: { credibilityScore?: number; upvoteCount?: number; already?: boolean; error?: string } = {};
      if (text) {
        try {
          body = JSON.parse(text) as typeof body;
        } catch {
          setUpvotingId(null);
          return;
        }
      }
      if (!res.ok) {
        setUpvotingId(null);
        return;
      }
      setTips((prev) =>
        prev.map((t) =>
          t._id === tipId
            ? {
                ...t,
                credibilityScore: body.credibilityScore ?? t.credibilityScore,
                upvoteCount: body.upvoteCount ?? t.upvoteCount ?? 0,
                hasUpvoted: true,
              }
            : t,
        ),
      );
    } finally {
      setUpvotingId(null);
    }
  };

  const filtered = filter === 'all' ? tips : tips.filter(t => t.category === filter);

  const filterButton = (tab: (typeof FILTER_TABS)[number]) => (
    <button
      key={tab.value}
      type="button"
      onClick={() => setFilter(tab.value)}
      style={{
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '9px',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background: filter === tab.value ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${filter === tab.value ? 'rgba(255,255,255,0.48)' : 'rgba(255,255,255,0.22)'}`,
        color: filter === tab.value ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.38)',
      }}
    >
      {tab.label}
    </button>
  );

  return (
    <div
      style={{
        width: 'min(300px, 100%)',
        flexShrink: 0,
        minHeight: 0,
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.25)',
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes feedLocateRing {
          from { transform: scale(1); opacity: 0.4; }
          to   { transform: scale(1.6); opacity: 0; }
        }
        .feed-locate-tooltip {
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease;
        }
        .feed-locate:hover .feed-locate-tooltip { opacity: 1; }
      `}</style>

      {/* Map actions — spaced across bar, inset from edges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          padding: '12px 22px 10px',
          boxSizing: 'border-box',
          flexShrink: 0,
          borderBottom: '2px solid rgba(255,255,255,0.14)',
        }}
      >
        <div
          className="feed-locate"
          onClick={onLocate}
          style={{
            position: 'relative',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1.5px solid #3b82f6',
              opacity: 0.4,
              animation: 'feedLocateRing 1.5s ease-out infinite',
            }}
          />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', display: 'block', flexShrink: 0 }} />
          <span
            className="feed-locate-tooltip"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.75)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 10,
              letterSpacing: '0.05em',
              padding: '4px 8px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.12)',
              whiteSpace: 'nowrap',
              fontFamily: FONT,
              zIndex: 5,
            }}
          >
            Location
          </span>
        </div>

        <button type="button" onClick={onToggle3D} style={pill}>
          {is3D ? '2D' : '3D'}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings — flare distance"
          aria-label="Open settings"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: 15,
            lineHeight: 1,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          ⚙
        </button>

        {user ? (
          <div
            onClick={() => setPanelOpen((v) => !v)}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#3b82f6',
              border: `1.5px solid ${avatarHover ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 500,
              color: '#fff',
              fontFamily: FONT,
              cursor: 'pointer',
              transition: 'border-color 150ms ease',
              flexShrink: 0,
            }}
          >
            {user.username[0].toUpperCase()}
          </div>
        ) : (
          <button type="button" onClick={onAuthOpen} style={{ ...pill, padding: '4px 10px' }}>
            Sign in
          </button>
        )}
      </div>

      {user && panelOpen && (
        <ProfilePanel user={user} onClose={() => setPanelOpen(false)} onSignOut={() => { setPanelOpen(false); onSignOut(); }} />
      )}

      <div style={{ padding: '16px 16px 0', borderBottom: '2px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            marginBottom: 12,
          }}
        >
          <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontWeight: 400, fontSize: '20px', color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.01em' }}>
            Live Feed
          </div>
          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            Within {formatFlareRadiusShort(radius)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', paddingBottom: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px 6px',
              width: '100%',
              justifyItems: 'center',
            }}
          >
            {FILTER_ROW1.map(filterButton)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 35, flexWrap: 'wrap' }}>
            {FILTER_ROW2.map(filterButton)}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {filtered.length === 0 && <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>NO FLARES IN AREA</div>}
        {filtered.map((tip) => {
          const color = SEVERITY_COLORS[tip.category] ?? '#888';
          /** Ring only (2px): gradient is hidden behind an opaque inner fill so it doesn’t tint the card. */
          const ringGradient = `linear-gradient(90deg, ${color} 0%, ${color}cc 12%, ${color}55 38%, ${color}1a 68%, transparent 100%)`;
          return (
            <div
              key={tip._id}
              style={{
                marginBottom: 8,
                padding: 2,
                borderRadius: 10,
                background: ringGradient,
              }}
            >
              <div
                style={{
                  borderRadius: 8,
                  padding: '12px 15px',
                  background: '#141420',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginBottom: '4px', textTransform: 'uppercase' }}>
                  {tip.category.replace('_', ' ')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.8)',
                    marginBottom: '6px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {tip.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{timeAgo(tip.createdAt)}</span>
                    <CredibilityBadge score={tip.credibilityScore} />
                  </div>
                  {user && String(tip.userId) !== user._id && (
                    <button
                      type="button"
                      disabled={upvotingId === tip._id || tip.hasUpvoted}
                      onClick={() => handleUpvote(tip._id)}
                      title={tip.hasUpvoted ? 'You supported this flare' : 'Upvote to raise credibility'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        fontFamily: 'inherit',
                        textTransform: 'uppercase',
                        cursor: tip.hasUpvoted || upvotingId === tip._id ? 'default' : 'pointer',
                        background: tip.hasUpvoted ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${tip.hasUpvoted ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.12)'}`,
                        color: tip.hasUpvoted ? '#93c5fd' : 'rgba(255,255,255,0.45)',
                        opacity: upvotingId === tip._id ? 0.6 : 1,
                      }}
                    >
                      <span aria-hidden>▲</span>
                      {tip.upvoteCount !== undefined && tip.upvoteCount > 0 ? tip.upvoteCount : 'Upvote'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
