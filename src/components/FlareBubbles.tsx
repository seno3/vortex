'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tip, TipCategory } from '@/types';

interface BuildingGroup {
  buildingId: string;
  lng: number;
  lat: number;
  flares: Tip[];
}

interface MapContext {
  map: any;
  mapboxGL: any;
}

interface FlareBubblesProps {
  mapContext: MapContext | null;
  lng: number;
  lat: number;
  radius: number;
}

const SEVERITY_COLORS: Record<TipCategory, string> = {
  active_threat: '#ef4444',
  weather: '#3b82f6',
  infrastructure: '#f59e0b',
  general_safety: '#22c55e',
};

const SEVERITY_ORDER: TipCategory[] = ['active_threat', 'infrastructure', 'weather', 'general_safety'];

function topSeverity(flares: Tip[]): TipCategory {
  for (const cat of SEVERITY_ORDER) {
    if (flares.some(f => f.category === cat)) return cat;
  }
  return 'general_safety';
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function Bubble({
  group,
  expanded,
  onExpand,
  onCollapse,
}: {
  group: BuildingGroup;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const accentColor = SEVERITY_COLORS[topSeverity(group.flares)];

  return (
    <div
      style={{ fontFamily: 'var(--font-sans, sans-serif)', userSelect: 'none' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Bubble body */}
      <div
        onClick={expanded ? undefined : onExpand}
        style={{
          maxWidth: expanded ? 260 : 80,
          maxHeight: expanded ? 320 : 34,
          width: expanded ? 260 : undefined,
          overflow: 'hidden',
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${expanded ? 'rgba(255,255,255,0.12)' : accentColor + '66'}`,
          borderRadius: expanded ? 12 : 8,
          cursor: expanded ? 'default' : 'pointer',
          transition: 'max-width 250ms ease-out, max-height 250ms ease-out, border-radius 200ms ease-out',
        }}
      >
        {expanded ? (
          /* ── Expanded content ── */
          <div
            className="flare-bubble-scroll"
            style={{ overflowY: 'auto', maxHeight: 320 }}
          >
            <div style={{ padding: '10px 12px 2px' }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <span style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  {group.flares.length} {group.flares.length === 1 ? 'flare' : 'flares'}
                </span>
                <button
                  onClick={onCollapse}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 0 8px',
                    lineHeight: 0,
                    color: 'rgba(255,255,255,0.4)',
                  }}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 2L12 12M12 2L2 12"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Flare rows */}
              {group.flares.map((flare, i) => (
                <div
                  key={flare._id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    animation: 'bubbleRowIn 200ms ease both',
                    animationDelay: `${80 + i * 40}ms`,
                  }}
                >
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: SEVERITY_COLORS[flare.category],
                    flexShrink: 0,
                    marginTop: 3,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.78)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {flare.description}
                    </div>
                    <div style={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.28)',
                      fontFamily: 'var(--font-mono, monospace)',
                      marginTop: 2,
                      letterSpacing: '0.06em',
                    }}>
                      {timeAgo(flare.createdAt)} ago
                    </div>
                  </div>
                </div>
              ))}

              {/* Bottom padding */}
              <div style={{ height: 6 }} />
            </div>
          </div>
        ) : (
          /* ── Collapsed content ── */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 9px',
            whiteSpace: 'nowrap',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accentColor,
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.82)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.01em',
            }}>
              {group.flares.length}
            </span>
          </div>
        )}
      </div>

      {/* Speech bubble tail */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: 7 }}>
        {/* Border triangle */}
        <div style={{
          position: 'absolute',
          top: 0,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: expanded ? '7px solid rgba(255,255,255,0.12)' : `7px solid ${accentColor}66`,
        }} />
        {/* Fill triangle */}
        <div style={{
          position: 'absolute',
          top: 1,
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(10,10,10,0.92)',
        }} />
      </div>
    </div>
  );
}

export default function FlareBubbles({ mapContext, lng, lat, radius }: FlareBubblesProps) {
  const [groups, setGroups] = useState<BuildingGroup[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Map from buildingId → { marker, el }
  const markersRef = useRef<Map<string, { marker: any; el: HTMLDivElement }>>(new Map());
  // Increment to force re-render after marker DOM elements are created
  const [portalTick, setPortalTick] = useState(0);

  // Inject animation keyframes + scrollbar-hiding class once
  useEffect(() => {
    if (document.getElementById('flare-bubble-style')) return;
    const s = document.createElement('style');
    s.id = 'flare-bubble-style';
    s.textContent = `
      @keyframes bubbleRowIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .flare-bubble-scroll::-webkit-scrollbar { display: none; }
      .flare-bubble-scroll { scrollbar-width: none; }
    `;
    document.head.appendChild(s);
  }, []);

  // Fetch tips and group by buildingId
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/tips?lng=${lng}&lat=${lat}&radius=${radius}`,
          { credentials: 'include' },
        );
        const tips: Tip[] = await res.json();
        if (cancelled || !Array.isArray(tips)) return;

        const grouped = new Map<string, BuildingGroup>();
        for (const tip of tips) {
          if (!tip.buildingId) continue;
          if (!grouped.has(tip.buildingId)) {
            grouped.set(tip.buildingId, {
              buildingId: tip.buildingId,
              lng: tip.location.coordinates[0],
              lat: tip.location.coordinates[1],
              flares: [],
            });
          }
          grouped.get(tip.buildingId)!.flares.push(tip);
        }

        if (!cancelled) setGroups(Array.from(grouped.values()));
      } catch { /* silent */ }
    };

    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lng, lat, radius]);

  // Create / remove Mapbox markers when groups or map changes
  useEffect(() => {
    if (!mapContext) return;
    const { map, mapboxGL } = mapContext;

    const currentIds = new Set(groups.map(g => g.buildingId));
    let changed = false;

    // Add markers for new building groups
    for (const group of groups) {
      if (markersRef.current.has(group.buildingId)) continue;
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;z-index:10;';
      const marker = new mapboxGL.Marker({ element: el, anchor: 'bottom', offset: [0, -2] })
        .setLngLat([group.lng, group.lat])
        .addTo(map);
      markersRef.current.set(group.buildingId, { marker, el });
      changed = true;
    }

    // Remove markers for buildings that no longer have flares
    const toRemove: string[] = [];
    markersRef.current.forEach(({ marker }, buildingId) => {
      if (!currentIds.has(buildingId)) {
        marker.remove();
        toRemove.push(buildingId);
        changed = true;
      }
    });
    toRemove.forEach(id => markersRef.current.delete(id));

    if (changed) setPortalTick(t => t + 1);
  }, [mapContext, groups]);

  // Collapse expanded bubble on map click outside the bubble
  useEffect(() => {
    if (!mapContext) return;
    const { map } = mapContext;
    const handler = () => setExpandedId(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [mapContext]);

  // Remove all markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
    };
  }, []);

  if (!mapContext) return null;

  // Render React portals into each marker's DOM element
  const portals: React.ReactNode[] = [];
  markersRef.current.forEach(({ el }, buildingId) => {
    const group = groups.find(g => g.buildingId === buildingId);
    if (!group) return;
    portals.push(
      createPortal(
        <Bubble
          key={`${buildingId}-${portalTick}`}
          group={group}
          expanded={expandedId === buildingId}
          onExpand={() => setExpandedId(buildingId)}
          onCollapse={() => setExpandedId(null)}
        />,
        el,
      ),
    );
  });

  return <>{portals}</>;
}
