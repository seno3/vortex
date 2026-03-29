export const FLARE_RADIUS_STORAGE_KEY = 'vigil_flare_radius_m';
export const DEFAULT_FLARE_RADIUS_M = 1609;

/** Preset radii in meters; labels are approximate for US users. */
export const FLARE_RADIUS_PRESETS: { meters: number; label: string }[] = [
  { meters: 402, label: '1/4 mi' },
  { meters: 804, label: '1/2 mi' },
  { meters: 1609, label: '1 mi' },
  { meters: 3218, label: '2 mi' },
  { meters: 8046, label: '5 mi' },
  { meters: 16093, label: '10 mi' },
];

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

export function formatFlareRadiusShort(meters: number): string {
  const p = FLARE_RADIUS_PRESETS.find((x) => x.meters === meters);
  if (p) return p.label;
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  return `${meters} m`;
}
