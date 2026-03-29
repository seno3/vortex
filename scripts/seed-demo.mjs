/**
 * Fetches real OSM data for Moore, Oklahoma and writes it to src/lib/fallback.ts.
 * Run once with: node scripts/seed-demo.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LAT = 35.3395;
const LNG = -97.4868;
const RADIUS = 800;

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function query(q) {
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`  Trying ${endpoint}…`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429) { console.log('  429 — trying next mirror'); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  throw new Error('All Overpass mirrors failed');
}

function inferType(tags = {}) {
  const b = tags.building ?? '';
  const a = tags.amenity ?? '';
  if (a === 'hospital' || b === 'hospital') return 'hospital';
  if (a === 'school' || b === 'school') return 'school';
  if (a === 'fire_station') return 'fire_station';
  if (b === 'commercial' || b === 'retail' || b === 'office') return 'commercial';
  if (b === 'industrial' || b === 'warehouse') return 'industrial';
  return 'residential';
}

function inferMaterial(tags = {}, type) {
  const m = tags['building:material'] ?? '';
  if (m.includes('concrete')) return 'concrete';
  if (m.includes('steel') || m.includes('metal')) return 'steel';
  if (m.includes('brick') || m.includes('stone') || m.includes('masonry')) return 'brick';
  if (m.includes('wood') || m.includes('timber')) return 'wood';
  if (type === 'hospital' || type === 'industrial') return 'concrete';
  if (type === 'commercial' || type === 'school') return 'brick';
  return 'wood';
}

function centroid(polygon) {
  return {
    lat: polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
    lng: polygon.reduce((s, p) => s + p[1], 0) / polygon.length,
  };
}

function area(polygon) {
  let a = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[(i + 1) % polygon.length];
    const x1 = lng1 * 111320 * Math.cos(lat1 * Math.PI / 180);
    const y1 = lat1 * 110540;
    const x2 = lng2 * 111320 * Math.cos(lat2 * Math.PI / 180);
    const y2 = lat2 * 110540;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function simplify(polygon) {
  if (polygon.length <= 8) return polygon;
  const lats = polygon.map(p => p[0]);
  const lngs = polygon.map(p => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.min(...lats), Math.max(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
    [Math.max(...lats), Math.min(...lngs)],
  ];
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

console.log('\n=== VORTEX DEMO DATA SEEDER ===\n');
console.log(`Fetching OSM data for Moore, Oklahoma (${LAT}, ${LNG}, r=${RADIUS}m)\n`);

console.log('1/3  Buildings…');
const buildingData = await query(`
[out:json][timeout:30];
(way["building"](around:${RADIUS},${LAT},${LNG}););
out body geom;
`.trim());

const buildings = [];
for (const el of buildingData.elements) {
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue;
  const polygon = simplify(el.geometry.map(p => [p.lat, p.lon]));
  const tags = el.tags ?? {};
  const type = inferType(tags);
  buildings.push({
    id: `b${el.id}`,
    centroid: centroid(polygon),
    polygon,
    type,
    levels: parseInt(tags['building:levels'] ?? (type === 'commercial' ? '2' : '1'), 10) || 1,
    material: inferMaterial(tags, type),
    area_sqm: Math.round(area(polygon)),
  });
}
console.log(`   → ${buildings.length} buildings`);

console.log('2/3  Roads…');
const roadData = await query(`
[out:json][timeout:30];
(way["highway"~"primary|secondary|tertiary|residential"](around:${RADIUS},${LAT},${LNG}););
out body geom;
`.trim());

const roads = [];
for (const el of roadData.elements) {
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
  const tags = el.tags ?? {};
  roads.push({
    id: `r${el.id}`,
    name: tags.name ?? tags.ref ?? 'Unnamed Road',
    geometry: el.geometry.map(p => [p.lat, p.lon]),
    type: tags.highway ?? 'residential',
  });
}
console.log(`   → ${roads.length} roads`);

console.log('3/3  Infrastructure…');
const infraData = await query(`
[out:json][timeout:30];
(node["amenity"~"hospital|school|fire_station|shelter|community_centre"](around:${RADIUS},${LAT},${LNG});
 way["amenity"~"hospital|school|fire_station|shelter|community_centre"](around:${RADIUS},${LAT},${LNG}););
out body geom;
`.trim());

const infrastructure = [];
for (const el of infraData.elements) {
  const tags = el.tags ?? {};
  let position;
  if (el.type === 'node') {
    position = { lat: el.lat, lng: el.lon };
  } else if (el.geometry?.length) {
    const poly = el.geometry.map(p => [p.lat, p.lon]);
    position = centroid(poly);
  } else continue;

  infrastructure.push({
    id: `i${el.id}`,
    type: tags.amenity ?? '',
    name: tags.name ?? tags.amenity ?? '',
    position,
    ...(tags.capacity ? { capacity: parseInt(tags.capacity, 10) } : {}),
  });
}
console.log(`   → ${infrastructure.length} infrastructure nodes`);

// ── Build TownModel ───────────────────────────────────────────────────────────

const allLats = buildings.map(b => b.centroid.lat);
const allLngs = buildings.map(b => b.centroid.lng);
const residentialCount = buildings.filter(b => b.type === 'residential').length;

const townModel = {
  center: { lat: LAT, lng: LNG },
  bounds: {
    north: Math.max(...allLats, LAT + 0.007),
    south: Math.min(...allLats, LAT - 0.007),
    east:  Math.max(...allLngs, LNG + 0.008),
    west:  Math.min(...allLngs, LNG - 0.008),
  },
  buildings,
  roads,
  infrastructure,
  population_estimate: Math.round(residentialCount * 2.5),
};

// ── Write to fallback.ts ──────────────────────────────────────────────────────

const outPath = join(__dirname, '../src/lib/fallback.ts');
const content = `import { TownModel } from '@/types';

// Moore, Oklahoma — real OSM data fetched ${new Date().toISOString().slice(0, 10)}
// Generated by scripts/seed-demo.mjs
export const DEMO_TOWN_MODEL: TownModel = ${JSON.stringify(townModel, null, 2)};
`;

writeFileSync(outPath, content, 'utf8');

console.log(`\n✓ Written to src/lib/fallback.ts`);
console.log(`  ${buildings.length} buildings · ${roads.length} roads · ${infrastructure.length} infra · ~${townModel.population_estimate.toLocaleString()} population\n`);
