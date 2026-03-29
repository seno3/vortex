'use client';

import { useEffect, useState } from 'react';
import type { Exit, ExitType } from '@/types';

interface BuildingPopupProps {
  buildingId: string;
  lng: number;
  lat: number;
  onClose: () => void;
  onAddExit: () => void;
  onFlyToExit: (center: [number, number], zoom: number) => void;
  onReportHere: () => void;
}

const EXIT_TYPE_LABELS: Record<ExitType, string> = {
  emergency:   'Emergency Exit',
  fire_escape: 'Fire Escape',
  main:        'Main Entrance',
  side:        'Side Door',
  service:     'Service Door',
  staircase:   'Staircase',
};

const EXIT_TYPE_COLOR: Record<ExitType, string> = {
  emergency:   '#22c55e',
  fire_escape: '#22c55e',
  main:        '#3b82f6',
  side:        '#6b7280',
  service:     '#6b7280',
  staircase:   '#8b5cf6',
};

function DiamondIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <span style={{ color, fontSize: '11px', lineHeight: 1 }}>
      {filled ? '◆' : '◇'}
    </span>
  );
}

function floorLabel(floor: number): string {
  if (floor === 0) return 'Ground floor';
  if (floor < 0) return `Basement ${Math.abs(floor)}`;
  return `Floor ${floor}`;
}

export default function BuildingPopup({
  buildingId,
  lng,
  lat,
  onClose,
  onAddExit,
  onFlyToExit,
  onReportHere,
}: BuildingPopupProps) {
  const [exits, setExits] = useState<Exit[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredExit, setHoveredExit] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/exits?lng=${lng.toFixed(5)}&lat=${lat.toFixed(5)}&radius=60&buildingId=${encodeURIComponent(buildingId)}`,
    )
      .then((r) => r.json())
      .then(({ exits: data }: { exits: Exit[] }) => setExits(data ?? []))
      .catch(() => setExits([]))
      .finally(() => setLoading(false));
  }, [buildingId, lng, lat]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        pointerEvents: 'none',
        padding: '0 0 80px 16px',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '20px',
          width: '320px',
          maxHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}>
              Building
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace, monospace', marginTop: '2px' }}>
              {buildingId}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Exits section */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase' }}>
              Exits
            </span>
            {!loading && (
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace, monospace' }}>
                {exits.length} mapped
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace', padding: '8px 0' }}>
              Loading…
            </div>
          ) : exits.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'ui-monospace, monospace', padding: '8px 0' }}>
              No exits mapped yet.
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '240px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {exits.map((exit) => {
                const active = exit.status === 'active';
                const color = EXIT_TYPE_COLOR[exit.exitType];
                const isHovered = hoveredExit === exit._id;
                return (
                  <button
                    key={exit._id}
                    onClick={() => onFlyToExit([exit.location.lng, exit.location.lat], 19)}
                    onMouseEnter={() => setHoveredExit(exit._id)}
                    onMouseLeave={() => setHoveredExit(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 8px',
                      borderRadius: '8px',
                      background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 100ms',
                      width: '100%',
                    }}
                  >
                    <DiamondIcon color={color} filled={active} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {EXIT_TYPE_LABELS[exit.exitType]}
                        {exit.description ? ` — ${exit.description}` : ''}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace', marginTop: '1px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {floorLabel(exit.floor)}
                        {exit.accessible && <span title="Wheelchair accessible">♿</span>}
                        {exit.source === 'osm' && (
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>OSM</span>
                        )}
                        {exit.source === 'community' && (
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>Community</span>
                        )}
                      </div>
                    </div>
                    {!active && (
                      <span style={{
                        fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: '999px',
                        background: exit.status === 'locked' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        border: `1px solid ${exit.status === 'locked' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
                        color: exit.status === 'locked' ? '#f59e0b' : '#ef4444',
                        fontFamily: 'ui-monospace, monospace',
                        flexShrink: 0,
                      }}>
                        {exit.status.toUpperCase()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Add exit button */}
          <button
            onClick={onAddExit}
            style={{
              marginTop: '12px',
              padding: '7px 0',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontFamily: 'ui-monospace, monospace',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(34,197,94,0.3)';
              (e.currentTarget as HTMLButtonElement).style.color = '#22c55e';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            + Add Exit
          </button>
        </div>

        {/* Divider + Report button */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={onReportHere}
            style={{
              width: '100%',
              padding: '7px 0',
              borderRadius: '999px',
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.25)',
              color: 'rgba(220,38,38,0.7)',
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontFamily: 'ui-monospace, monospace',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.08)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(220,38,38,0.7)';
            }}
          >
            Report Incident Here
          </button>
        </div>
      </div>
    </div>
  );
}
