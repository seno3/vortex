'use client';

import { useState } from 'react';
import type { ExitType } from '@/types';

interface ExitModalProps {
  buildingId: string;
  isPlacementMode: boolean;
  placedLocation: { lng: number; lat: number } | null;
  onEnterPlacement: () => void;
  onConfirmPlacement: () => void;
  onClose: () => void;
  onSubmit: (data: {
    buildingId: string;
    location: { lng: number; lat: number };
    exitType: ExitType;
    floor: number;
    description: string;
    accessible: boolean;
  }) => Promise<void>;
}

const EXIT_TYPES: { value: ExitType; label: string; green?: boolean }[] = [
  { value: 'main',        label: 'Main' },
  { value: 'side',        label: 'Side' },
  { value: 'emergency',   label: 'Emergency', green: true },
  { value: 'fire_escape', label: 'Fire Escape', green: true },
  { value: 'service',     label: 'Service' },
  { value: 'staircase',   label: 'Staircase' },
];

export default function ExitModal({
  buildingId,
  isPlacementMode,
  placedLocation,
  onEnterPlacement,
  onConfirmPlacement,
  onClose,
  onSubmit,
}: ExitModalProps) {
  const [exitType, setExitType] = useState<ExitType>('side');
  const [floor, setFloor] = useState(0);
  const [description, setDescription] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [loading, setLoading] = useState(false);

  const step = placedLocation ? 2 : 1;

  const handleSubmit = async () => {
    if (!placedLocation) return;
    setLoading(true);
    try {
      await onSubmit({
        buildingId,
        location: placedLocation,
        exitType,
        floor,
        description: description.trim(),
        accessible,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // When in placement mode, don't show the full modal (map is behind)
  if (isPlacementMode) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 55,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '20px',
          padding: '28px',
          width: '400px',
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '3px' }}>
              Map an Exit
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>
              Step {step} of 2 — {step === 1 ? 'Place on building' : 'Exit details'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
          >×</button>
        </div>

        {step === 1 ? (
          /* ── Step 1: Placement ─────────────────────────────── */
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', lineHeight: 1.6 }}>
              Click the exact door location on the building perimeter. A marker will appear where you click.
            </div>
            <button
              onClick={onEnterPlacement}
              style={{
                width: '100%', padding: '12px', borderRadius: '999px',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e',
                fontSize: '12px', letterSpacing: '0.2em',
                fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.18)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.1)'; }}
            >
              Place on Map
            </button>
          </div>
        ) : (
          /* ── Step 2: Details ───────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Placed location confirmation */}
            <div style={{
              padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ color: '#22c55e', fontSize: '12px' }}>◆</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, monospace' }}>
                {placedLocation!.lat.toFixed(5)}, {placedLocation!.lng.toFixed(5)}
              </span>
              <button
                onClick={onEnterPlacement}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.3)', fontSize: '10px', cursor: 'pointer',
                  letterSpacing: '0.1em', fontFamily: 'ui-monospace, monospace',
                  textTransform: 'uppercase',
                }}
              >
                Move
              </button>
            </div>

            {/* Exit type */}
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', marginBottom: '8px' }}>
                Exit Type
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EXIT_TYPES.map((t) => {
                  const selected = exitType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setExitType(t.value)}
                      style={{
                        padding: '5px 12px', borderRadius: '999px', fontSize: '10px',
                        letterSpacing: '0.12em', fontFamily: 'ui-monospace, monospace',
                        textTransform: 'uppercase', cursor: 'pointer', transition: 'all 120ms ease',
                        background: selected
                          ? (t.green ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.18)')
                          : 'rgba(255,255,255,0.05)',
                        border: selected
                          ? `1px solid ${t.green ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.4)'}`
                          : `1px solid ${t.green ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)'}`,
                        color: selected
                          ? (t.green ? '#22c55e' : 'rgba(255,255,255,0.9)')
                          : (t.green ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.4)'),
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floor */}
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', marginBottom: '8px' }}>
                Floor
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setFloor((f) => Math.max(-2, f - 1))}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.7)', fontSize: '16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >−</button>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontFamily: 'ui-monospace, monospace', minWidth: '60px', textAlign: 'center' }}>
                  {floor === 0 ? 'Ground' : floor < 0 ? `B${Math.abs(floor)}` : `Floor ${floor}`}
                </span>
                <button
                  onClick={() => setFloor((f) => Math.min(10, f + 1))}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.7)', fontSize: '16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >+</button>
              </div>
            </div>

            {/* Description */}
            <div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                placeholder="e.g. North door near parking lot"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              {description.length > 100 && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: '4px' }}>
                  {description.length}/150
                </div>
              )}
            </div>

            {/* Accessible toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                ♿ Wheelchair accessible
              </span>
              <button
                onClick={() => setAccessible((a) => !a)}
                style={{
                  width: '44px', height: '24px', borderRadius: '999px',
                  background: accessible ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${accessible ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.15)'}`,
                  cursor: 'pointer', position: 'relative', transition: 'all 200ms ease',
                  padding: 0,
                }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: accessible ? '#3b82f6' : 'rgba(255,255,255,0.4)',
                  position: 'absolute', top: '3px',
                  left: accessible ? '23px' : '3px',
                  transition: 'left 200ms ease, background 200ms ease',
                }} />
              </button>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: '999px', marginTop: '4px',
                background: loading ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '12px', letterSpacing: '0.2em',
                fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
              }}
            >
              {loading ? 'Saving…' : 'Save Exit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
