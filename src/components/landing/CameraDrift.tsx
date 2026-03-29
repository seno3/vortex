'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

const BASE_LNG = -98.5795;
const BASE_LAT = 39.8283;

export function useCameraDrift(mapRef: React.RefObject<MapboxMap | null>) {
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768) return;

    let lastTime: number | null = null;

    const tick = (now: number) => {
      if (lastTime !== null) {
        tRef.current += now - lastTime;
      }
      lastTime = now;

      const map = mapRef.current;
      if (map) {
        const t = tRef.current;
        map.easeTo({
          bearing: Math.sin(t * 0.00008) * 6,
          center: [
            BASE_LNG + Math.sin(t * 0.00005) * 1.2,
            BASE_LAT + Math.cos(t * 0.00007) * 0.6,
          ],
          zoom: 4.2,
          duration: 0,
          easing: (x: number) => x,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [mapRef]);
}
