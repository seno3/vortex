'use client';

import { useCallback, useEffect, useState } from 'react';

const UNIT_KEY = 'vigil_unit';

export type PreferredUnit = 'mi' | 'km';

export function usePreferredUnit(): { unit: PreferredUnit; toggle: () => void } {
  const [unit, setUnit] = useState<PreferredUnit>('mi');

  useEffect(() => {
    const stored = localStorage.getItem(UNIT_KEY);
    if (stored === 'km' || stored === 'mi') setUnit(stored);
  }, []);

  const toggle = useCallback(() => {
    setUnit((u) => {
      const next: PreferredUnit = u === 'mi' ? 'km' : 'mi';
      localStorage.setItem(UNIT_KEY, next);
      return next;
    });
  }, []);

  return { unit, toggle };
}
