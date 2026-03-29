import { SceneLabel } from '@/types';

/**
 * Pre-written fallback labels for Moore, Oklahoma demo.
 * Positions are in Gaussian splat scene space (origin = town center).
 * Used when the Gemini API is unavailable during demo.
 *
 * Scale reference: 1 unit ≈ 10 meters at default 0.1 scale factor.
 */
export const DEMO_LABELS: SceneLabel[] = [
  // ── Agent 1: Tornado Path ────────────────────────────────────────────────
  {
    id: 'demo_path_1',
    position: [-6, 3, -8],
    text: 'EF4 VORTEX ENTRY — SW APPROACH',
    severity: 'critical',
    details: '166–200 mph winds · 800m path width · SW→NE track',
  },
  {
    id: 'demo_path_2',
    position: [0, 3.5, 0],
    text: 'PEAK INTENSITY ZONE',
    severity: 'critical',
    details: '200 mph peak · Maximum debris field radius 400m',
  },
  {
    id: 'demo_path_3',
    position: [5, 2.5, 6],
    text: 'PATH EXIT — NE QUADRANT',
    severity: 'warning',
    details: 'Wind speed tapering to EF2 levels · Tornado weakening',
  },

  // ── Agent 2: Structural Impact ───────────────────────────────────────────
  {
    id: 'demo_struct_1',
    position: [-1, 3, -2],
    text: 'STRUCTURAL FAILURE — DO NOT ENTER',
    severity: 'critical',
    details: 'DI 1 wood-frame residential · EF4 winds → total destruction',
  },
  {
    id: 'demo_struct_2',
    position: [2, 3, 1],
    text: 'PLAZA TOWERS ELEM — COLLAPSED',
    severity: 'critical',
    details: 'DI 6 brick school · EF4+ → roof/wall failure · Search priority',
  },
  {
    id: 'demo_struct_3',
    position: [-3, 2.5, 2],
    text: 'COMMERCIAL STRIP — MAJOR DAMAGE',
    severity: 'warning',
    details: 'DI 4 masonry commercial · EF4 winds → partial wall collapse',
  },
  {
    id: 'demo_struct_4',
    position: [4, 2, 4],
    text: 'MOORE MEDICAL CENTER — INTACT',
    severity: 'info' as SceneLabel['severity'],
    details: 'DI 7 reinforced concrete · Withstood EF4 — receiving casualties',
  },

  // ── Agent 3: Evacuation ──────────────────────────────────────────────────
  {
    id: 'demo_evac_1',
    position: [-5, 2.5, 0],
    text: 'EVACUATION ROUTE → EAST ON SE 19TH',
    severity: 'evacuation',
    details: 'Primary route clear · Leads to Moore Medical Center & I-35',
  },
  {
    id: 'demo_evac_2',
    position: [0, 2.5, -5],
    text: 'EASTERN AVE — BLOCKED',
    severity: 'critical',
    details: 'Debris field across roadway · Do not use · Use SE 19th instead',
  },
  {
    id: 'demo_evac_3',
    position: [6, 2, -3],
    text: 'SHELTER: MOORE COMMUNITY CENTER',
    severity: 'evacuation',
    details: 'Capacity 500 · Currently receiving displaced residents · Safe zone',
  },

  // ── Agent 4: Emergency Response ──────────────────────────────────────────
  {
    id: 'demo_resp_1',
    position: [3, 2.5, -4],
    text: 'COMMAND POST — FIRE STATION #1',
    severity: 'deployment',
    details: 'ICS Level 3 · All responding units report here · Radio Ch. 4',
  },
  {
    id: 'demo_resp_2',
    position: [-2, 2.5, 3],
    text: 'TRIAGE SITE — BRIARWOOD ELEM',
    severity: 'deployment',
    details: 'Primary triage · 8 ambulances staged · Trauma Level 1 protocol',
  },
  {
    id: 'demo_resp_3',
    position: [1, 3, -1],
    text: 'SEARCH PRIORITY ZONE A',
    severity: 'critical',
    details: '23 wood-frame homes · Est. 57 occupants unaccounted · USAR team 1',
  },
];
