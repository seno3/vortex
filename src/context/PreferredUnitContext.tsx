'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { syncFlareRadiusToComplementaryTier, type PreferredUnit } from '@/lib/flareRadius';

const UNIT_KEY = 'vigil_unit';

function readStoredUnit(): PreferredUnit {
  if (typeof window === 'undefined') return 'mi';
  const stored = localStorage.getItem(UNIT_KEY);
  return stored === 'km' || stored === 'mi' ? stored : 'mi';
}

type PreferredUnitContextValue = {
  unit: PreferredUnit;
  setUnit: (u: PreferredUnit) => void;
  toggle: () => void;
};

const PreferredUnitContext = createContext<PreferredUnitContextValue | null>(null);

export function PreferredUnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<PreferredUnit>(() => readStoredUnit());

  const setUnit = useCallback((u: PreferredUnit) => {
    setUnitState((prev) => {
      if (u === prev) return prev;
      syncFlareRadiusToComplementaryTier(prev, u);
      localStorage.setItem(UNIT_KEY, u);
      return u;
    });
  }, []);

  const toggle = useCallback(() => {
    setUnitState((prev) => {
      const next: PreferredUnit = prev === 'mi' ? 'km' : 'mi';
      syncFlareRadiusToComplementaryTier(prev, next);
      localStorage.setItem(UNIT_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ unit, setUnit, toggle }),
    [unit, setUnit, toggle],
  );

  return (
    <PreferredUnitContext.Provider value={value}>
      {children}
    </PreferredUnitContext.Provider>
  );
}

export function usePreferredUnit(): PreferredUnitContextValue {
  const ctx = useContext(PreferredUnitContext);
  if (!ctx) {
    throw new Error('usePreferredUnit must be used within PreferredUnitProvider');
  }
  return ctx;
}
