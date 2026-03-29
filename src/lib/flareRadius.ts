export const FLARE_RADIUS_STORAGE_KEY = 'vigil_flare_radius_m';
export const DEFAULT_FLARE_RADIUS_M = 1609;

export type PreferredUnit = 'mi' | 'km';

const FLARE_PRESETS_MI: { meters: number; label: string }[] = [
  { meters: 402, label: '1/4 mi' },
  { meters: 804, label: '1/2 mi' },
  { meters: 1609, label: '1 mi' },
  { meters: 3218, label: '2 mi' },
  { meters: 8046, label: '5 mi' },
  { meters: 16093, label: '10 mi' },
];

const FLARE_PRESETS_KM: { meters: number; label: string }[] = [
  { meters: 250, label: '1/4 km' },
  { meters: 500, label: '1/2 km' },
  { meters: 1000, label: '1 km' },
  { meters: 2000, label: '2 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
];

export function getFlareRadiusPresets(unit: PreferredUnit): { meters: number; label: string }[] {
  return unit === 'km' ? FLARE_PRESETS_KM : FLARE_PRESETS_MI;
}

export function readStoredFlareRadiusM(): number {
  if (typeof window === 'undefined') return DEFAULT_FLARE_RADIUS_M;
  const raw = localStorage.getItem(FLARE_RADIUS_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 100 || n > 500_000) return DEFAULT_FLARE_RADIUS_M;
  return n;
}

export function writeStoredFlareRadiusM(meters: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FLARE_RADIUS_STORAGE_KEY, String(Math.round(meters)));
  window.dispatchEvent(new Event('vigil-flare-radius'));
}

/**
 * When switching mi ↔ km, map the same tier (e.g. 5 mi → 5 km) by preset index.
 * Non-preset values snap to the nearest tier in the old unit, then use that index in the new unit.
 */
export function complementaryFlareRadiusForUnitSwitch(
  currentMeters: number,
  fromUnit: PreferredUnit,
  toUnit: PreferredUnit,
): number {
  if (fromUnit === toUnit) return currentMeters;
  const fromList = getFlareRadiusPresets(fromUnit);
  const toList = getFlareRadiusPresets(toUnit);
  let idx = fromList.findIndex((p) => p.meters === currentMeters);
  if (idx < 0) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < fromList.length; i++) {
      const d = Math.abs(fromList[i].meters - currentMeters);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    idx = best;
  }
  return toList[idx].meters;
}

export function syncFlareRadiusToComplementaryTier(
  fromUnit: PreferredUnit,
  toUnit: PreferredUnit,
): void {
  if (typeof window === 'undefined' || fromUnit === toUnit) return;
  const current = readStoredFlareRadiusM();
  const next = complementaryFlareRadiusForUnitSwitch(current, fromUnit, toUnit);
  writeStoredFlareRadiusM(next);
}

function formatArbitraryFlareMeters(meters: number, unit: PreferredUnit): string {
  if (unit === 'km') {
    if (meters >= 1000) {
      const km = meters / 1000;
      const rounded =
        km >= 10 || Math.abs(km - Math.round(km)) < 0.05 ? Math.round(km).toString() : km.toFixed(1);
      return `${rounded} km`;
    }
    return `${Math.round(meters)} m`;
  }
  const M_PER_MI = 1609.344;
  const mi = meters / M_PER_MI;
  const rounded =
    mi >= 10 || Math.abs(mi - Math.round(mi)) < 0.05 ? Math.round(mi).toString() : mi.toFixed(1);
  return `${rounded} mi`;
}

export function formatFlareRadiusShort(meters: number, unit: PreferredUnit = 'mi'): string {
  const presets = getFlareRadiusPresets(unit);
  const p = presets.find((x) => x.meters === meters);
  if (p) return p.label;
  return formatArbitraryFlareMeters(meters, unit);
}
