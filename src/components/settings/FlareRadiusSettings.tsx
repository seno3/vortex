'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatFlareRadiusShort,
  getFlareRadiusPresets,
  readStoredFlareRadiusM,
  writeStoredFlareRadiusM,
} from '@/lib/flareRadius';
import { usePreferredUnit } from '@/hooks/usePreferredUnit';

const FONT = 'var(--font-sans, sans-serif)';

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;

/** Matches the “Preferred units” pill + mono accent; compact for the right side of a settings row. */
const selectCompactStyle: React.CSSProperties = {
  maxWidth: 128,
  minWidth: 0,
  flexShrink: 0,
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 20,
  padding: '5px 8px',
  paddingRight: 24,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-mono, monospace)',
  letterSpacing: '0.02em',
  color: 'rgba(255,255,255,0.92)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  colorScheme: 'dark',
};

function IconFlare() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={12} cy={12} r={3} />
      <circle cx={12} cy={12} r={8} />
    </svg>
  );
}

export function FlareRadiusSelect() {
  const { unit } = usePreferredUnit();
  const [storedM, setStoredM] = useState(() => readStoredFlareRadiusM());

  const sync = useCallback(() => setStoredM(readStoredFlareRadiusM()), []);

  useEffect(() => {
    window.addEventListener('vigil-flare-radius', sync);
    return () => window.removeEventListener('vigil-flare-radius', sync);
  }, [sync]);

  const presets = useMemo(() => getFlareRadiusPresets(unit), [unit]);
  const presetSet = useMemo(() => new Set(presets.map((p) => p.meters)), [presets]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const meters = Number(e.target.value);
    if (!Number.isFinite(meters)) return;
    writeStoredFlareRadiusM(meters);
    setStoredM(meters);
  };

  return (
    <select
      aria-label="Flare visibility distance"
      value={storedM}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={selectCompactStyle}
    >
      {!presetSet.has(storedM) && (
        <option value={storedM} style={{ background: '#1a1a24', color: '#f4f4f8' }}>
          {formatFlareRadiusShort(storedM, unit)}
        </option>
      )}
      {presets.map(({ meters, label }) => (
        <option key={meters} value={meters} style={{ background: '#1a1a24', color: '#f4f4f8' }}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default function FlareRadiusSettings() {
  return (
    <div
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        borderRadius: 10,
      }}
    >
      <IconFlare />
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
        Flare distance
      </span>
      <FlareRadiusSelect />
    </div>
  );
}
