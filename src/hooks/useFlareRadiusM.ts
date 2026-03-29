'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FLARE_RADIUS_M, readStoredFlareRadiusM } from '@/lib/flareRadius';

export function useFlareRadiusM(): number {
  const [meters, setMeters] = useState(DEFAULT_FLARE_RADIUS_M);

  const sync = useCallback(() => {
    setMeters(readStoredFlareRadiusM());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('vigil-flare-radius', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('vigil-flare-radius', sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  return meters;
}
