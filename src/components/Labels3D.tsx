'use client';

import { Html } from '@react-three/drei';
import { SceneLabel, LabelSeverity } from '@/types';

interface Labels3DProps {
  labels: SceneLabel[];
}

const SEVERITY_COLORS: Record<LabelSeverity, string> = {
  critical:   '#ef4444',
  warning:    '#ff6b2b',
  evacuation: '#4ade80',
  deployment: '#22d3ee',
  info:       '#a78bfa',
  safe:       '#4ade80',
};

const SEVERITY_BG: Record<LabelSeverity, string> = {
  critical:   'rgba(239,68,68,0.08)',
  warning:    'rgba(255,107,43,0.08)',
  evacuation: 'rgba(74,222,128,0.08)',
  deployment: 'rgba(34,211,238,0.08)',
  info:       'rgba(167,139,250,0.08)',
  safe:       'rgba(74,222,128,0.06)',
};

export default function Labels3D({ labels }: Labels3DProps) {
  return (
    <group name="labels">
      {labels.map((label, i) => {
        const color = SEVERITY_COLORS[label.severity] ?? '#22d3ee';
        const bg    = SEVERITY_BG[label.severity]    ?? 'rgba(34,211,238,0.08)';

        return (
          <Html
            key={label.id}
            position={label.position}
            center
            distanceFactor={15}
            zIndexRange={[0, 50]}
            style={{ pointerEvents: 'auto' }}
          >
            <div
              style={{
                background: `rgba(8, 12, 20, 0.92)`,
                borderLeft: `3px solid ${color}`,
                borderTop: `1px solid ${color}22`,
                borderRight: `1px solid rgba(255,255,255,0.05)`,
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
                padding: '8px 12px',
                borderRadius: '3px',
                color: 'white',
                fontFamily: 'ui-monospace, "JetBrains Mono", "Fira Code", monospace',
                fontSize: '11px',
                maxWidth: '220px',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: `0 0 12px ${color}22, 0 2px 8px rgba(0,0,0,0.5)`,
                animation: `fadeInLabel 0.4s ease-out ${i * 0.08}s both`,
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              {/* Severity indicator dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: label.details ? '4px' : 0 }}>
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 4px ${color}`,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#f0f4f8',
                    letterSpacing: '0.04em',
                    lineHeight: 1.3,
                  }}
                >
                  {label.text}
                </div>
              </div>
              {label.details && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#8899aa',
                    lineHeight: 1.4,
                    marginLeft: '11px',
                  }}
                >
                  {label.details}
                </div>
              )}
            </div>
            <style>{`
              @keyframes fadeInLabel {
                from { opacity: 0; transform: translateY(6px) scale(0.95); }
                to   { opacity: 1; transform: translateY(0)  scale(1);    }
              }
            `}</style>
          </Html>
        );
      })}
    </group>
  );
}
