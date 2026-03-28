'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { PathSegment } from '@/types';

interface TimeSliderProps {
  timeProgress: number;          // 0.0 → 1.0
  isPlaying: boolean;
  pathSegments: PathSegment[];
  playbackDuration: number;      // seconds
  onProgressChange: (p: number) => void;
  onPlayPause: () => void;
}

// EF tier classification by wind speed (mph)
function efTier(mph: number): { ef: number; color: string } {
  if (mph < 73)  return { ef: 0, color: '#22d3ee' };
  if (mph < 113) return { ef: 1, color: '#4ade80' };
  if (mph < 158) return { ef: 2, color: '#ecc94b' };
  if (mph < 207) return { ef: 3, color: '#f97316' };
  if (mph < 261) return { ef: 4, color: '#ef4444' };
  return             { ef: 5, color: '#dc2626' };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function TimeSlider({
  timeProgress,
  isPlaying,
  pathSegments,
  playbackDuration,
  onProgressChange,
  onPlayPause,
}: TimeSliderProps) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef(false);
  // Keep latest callbacks in refs so drag mousemove listener never goes stale
  const onProgressRef = useRef(onProgressChange);
  useEffect(() => { onProgressRef.current = onProgressChange; }, [onProgressChange]);

  const [tooltipTick, setTooltipTick] = useState<number | null>(null);

  // ── Interpolated wind speed at current position ──────────────────────────
  const currentWind = (() => {
    if (pathSegments.length === 0) return 0;
    const idx = timeProgress * (pathSegments.length - 1);
    const i   = Math.floor(idx);
    const t   = idx - i;
    const a   = pathSegments[i];
    const b   = pathSegments[Math.min(i + 1, pathSegments.length - 1)];
    return lerp(a.wind_speed_mph, b.wind_speed_mph, t);
  })();

  const { color: windColor, ef: windEf } = efTier(currentWind);

  // ── Time label: T+MM:SS ───────────────────────────────────────────────────
  const elapsed = timeProgress * playbackDuration;
  const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const ss = Math.floor(elapsed % 60).toString().padStart(2, '0');
  const timeLabel = `T+${mm}:${ss}`;

  // ── Track gradient (EF colors across the full path) ───────────────────────
  const gradientCss = (() => {
    if (pathSegments.length < 2) return '#ef4444';
    const stops = pathSegments.map((seg, i) => {
      const pct = (i / (pathSegments.length - 1)) * 100;
      return `${efTier(seg.wind_speed_mph).color} ${pct.toFixed(1)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  })();

  // ── Drag helpers ─────────────────────────────────────────────────────────
  const getProgressFromX = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    onProgressRef.current(getProgressFromX(e.clientX));
  }, [getProgressFromX]);

  // Register document-level drag handlers once
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onProgressRef.current(getProgressFromX(e.clientX));
    };
    const onUp = () => { dragging.current = false; };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [getProgressFromX]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onPlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onProgressRef.current(Math.max(0, timeProgress - 0.05));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onProgressRef.current(Math.min(1, timeProgress + 0.05));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [timeProgress, onPlayPause]);

  const thumbPct = timeProgress * 100;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        padding: '0 16px',
        background: 'rgba(6, 10, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontFamily: 'ui-monospace, JetBrains Mono, monospace',
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      {/* ── Left section: time + wind ─────────────────────────────────────── */}
      <div
        style={{
          width: '96px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#8899aa', letterSpacing: '0.03em' }}>
          {timeLabel}
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: windColor,
            letterSpacing: '0.04em',
          }}
        >
          {Math.round(currentWind)} MPH
        </span>
        <span style={{ fontSize: '9px', color: '#556677', letterSpacing: '0.05em' }}>
          EF{windEf}
        </span>
      </div>

      {/* ── Center section: scrubber ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 8px' }}>

        {/* Tick marks row */}
        <div style={{ position: 'relative', height: '14px' }}>
          {pathSegments.map((seg, i) => {
            const pct = pathSegments.length > 1
              ? (i / (pathSegments.length - 1)) * 100
              : 0;
            const { color, ef } = efTier(seg.wind_speed_mph);
            const isHovered = tooltipTick === i;

            return (
              <div
                key={i}
                onMouseEnter={() => setTooltipTick(i)}
                onMouseLeave={() => setTooltipTick(null)}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  width: '2px',
                  height: '6px',
                  background: color,
                  opacity: isHovered ? 1 : 0.7,
                  borderRadius: '1px',
                  cursor: 'pointer',
                  transition: 'opacity 0.1s',
                }}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(6, 10, 18, 0.95)',
                      border: `1px solid ${color}`,
                      borderRadius: '4px',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      fontSize: '10px',
                      color: '#ccd6e0',
                      pointerEvents: 'none',
                      zIndex: 20,
                    }}
                  >
                    <span style={{ color, fontWeight: 700 }}>EF{ef}</span>
                    {' · '}
                    {Math.round(seg.wind_speed_mph)} MPH
                    {' · '}
                    {Math.round(seg.width_m)}m wide
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Track + thumb */}
        <div
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          style={{
            position: 'relative',
            height: '3px',
            borderRadius: '2px',
            background: '#1e2a3a',
            cursor: 'pointer',
          }}
        >
          {/* Filled gradient portion */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${thumbPct}%`,
              borderRadius: '2px',
              background: gradientCss,
              backgroundSize: `${(1 / Math.max(timeProgress, 0.001)) * 100}% 100%`,
            }}
          />

          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${thumbPct}%`,
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'white',
              boxShadow: '0 0 8px #ef4444, 0 0 2px rgba(255,255,255,0.8)',
              cursor: 'grab',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Right section: play/pause ─────────────────────────────────────── */}
      <div
        style={{
          width: '64px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={onPlayPause}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#ef4444',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s, border-color 0.15s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.28)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)';
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}
