'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Emergency, EmergencyType } from '@/types';
import { useUserLocation } from '@/hooks/useUserLocation';
import { distanceMeters } from '@/lib/geo';

const EMERGENCY_COLORS: Record<EmergencyType, string> = {
  shooting:   '#DC2626',
  tornado:    '#D97706',
  earthquake: '#EA580C',
  fire:       '#DC2626',
};

const KEYFRAMES = `
@keyframes emergMarkerRing {
  from { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
  to   { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
}
`;

function formatDist(meters: number): string {
  const unit = (typeof localStorage !== 'undefined' ? localStorage.getItem('vigil_unit') : null) ?? 'mi';
  if (unit === 'km') {
    return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)} km`;
  }
  const feet = meters * 3.28084;
  return feet < 528 ? `${Math.round(feet)} ft` : `${(meters / 1609.34).toFixed(1)} mi`;
}

interface MapContext { map: any; mapboxGL: any; }

function MarkerContent({ color, address, distLabel }: {
  color: string;
  address?: string;
  distLabel: string | null;
}) {
  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Expanding rings */}
      {[0, 0.8, 1.6].map((delay, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 52, height: 52,
          top: '50%', left: '50%',
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          animation: `emergMarkerRing 2.4s ease-out ${delay}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Core dot */}
      <div style={{
        position: 'absolute',
        width: 14, height: 14,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: color,
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: `0 0 16px ${color}99, 0 0 4px ${color}`,
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Label pill */}
      {(address || distLabel) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, 18px)',
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${color}55`,
          borderRadius: 100,
          padding: '5px 13px',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          pointerEvents: 'none',
          zIndex: 3,
          fontFamily: '"Geist Mono", ui-monospace, monospace',
          fontSize: 11,
        }}>
          {distLabel && (
            <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, letterSpacing: '0.03em' }}>
              {distLabel} away
            </span>
          )}
          {distLabel && address && (
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
          )}
          {address && (
            <span style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}>
              {address.length > 30 ? address.slice(0, 30) + '…' : address}
            </span>
          )}
        </div>
      )}
    </>
  );
}

export default function EmergencyMarker({
  emergency,
  mapContext,
}: {
  emergency: Emergency;
  mapContext: MapContext;
}) {
  const [markerEl, setMarkerEl] = useState<HTMLDivElement | null>(null);
  const userLoc = useUserLocation();

  const color = EMERGENCY_COLORS[emergency.type];
  const distM = userLoc
    ? distanceMeters(userLoc.lat, userLoc.lng, emergency.lat, emergency.lng)
    : null;
  const distLabel = distM !== null ? formatDist(distM) : null;

  useEffect(() => {
    const { map, mapboxGL } = mapContext;
    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;overflow:visible;';

    const marker = new mapboxGL.Marker({ element: el, anchor: 'center' })
      .setLngLat([emergency.lng, emergency.lat])
      .addTo(map);

    setMarkerEl(el);

    return () => {
      marker.remove();
      setMarkerEl(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContext, emergency.lat, emergency.lng]);

  if (!markerEl) return null;

  return createPortal(
    <MarkerContent color={color} address={emergency.address} distLabel={distLabel} />,
    markerEl,
  );
}
