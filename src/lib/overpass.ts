import { Building, Road, Infrastructure } from '@/types';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes?: number[];
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements: Array<OverpassNode | OverpassWay>;
}

// Mirror list — rotate through them to avoid 429s from the main endpoint
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const OVERPASS_ENDPOINT = OVERPASS_ENDPOINTS[0];
const TIMEOUT = 8000;

async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastError: Error = new Error('No endpoints tried');

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(TIMEOUT),
      });

      if (res.status === 429) {
        lastError = new Error(`Overpass API error: 429`);
        continue; // try next mirror
      }
      if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
      return res.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes('429')) continue; // try next mirror
      throw lastError; // non-rate-limit errors propagate immediately
    }
  }

  throw lastError;
}

function inferBuildingType(tags: Record<string, string> = {}): string {
  const b = tags['building'] ?? '';
  const amenity = tags['amenity'] ?? '';

  if (amenity === 'hospital' || b === 'hospital') return 'hospital';
  if (amenity === 'school' || b === 'school' || b === 'university') return 'school';
  if (amenity === 'fire_station' || b === 'fire_station') return 'fire_station';
  if (b === 'commercial' || b === 'retail' || b === 'office' || b === 'supermarket') return 'commercial';
  if (b === 'industrial' || b === 'warehouse') return 'industrial';
  if (b === 'church' || b === 'cathedral' || amenity === 'place_of_worship') return 'church';
  return 'residential';
}

function inferMaterial(tags: Record<string, string> = {}, type: string): string {
  const mat = tags['building:material'] ?? '';
  if (mat === 'concrete' || mat === 'reinforced_concrete') return 'concrete';
  if (mat === 'steel' || mat === 'metal') return 'steel';
  if (mat === 'brick' || mat === 'stone' || mat === 'masonry') return 'brick';
  if (mat === 'wood' || mat === 'timber') return 'wood';

  if (type === 'hospital' || type === 'industrial') return 'concrete';
  if (type === 'commercial' || type === 'school') return 'brick';
  return 'wood';
}

function polygonArea(polygon: [number, number][]): number {
  // Shoelace formula in approximate meters
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[(i + 1) % polygon.length];
    const x1 = lng1 * 111320 * Math.cos(lat1 * (Math.PI / 180));
    const y1 = lat1 * 110540;
    const x2 = lng2 * 111320 * Math.cos(lat2 * (Math.PI / 180));
    const y2 = lat2 * 110540;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function computeCentroid(polygon: [number, number][]): { lat: number; lng: number } {
  const lat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const lng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return { lat, lng };
}

export async function fetchBuildings(
  lat: number,
  lng: number,
  radius: number
): Promise<Building[]> {
  const query = `
[out:json][timeout:25];
(
  way["building"](around:${radius},${lat},${lng});
);
out body geom;
  `.trim();

  const data = await queryOverpass(query);
  const buildings: Building[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way') continue;
    const way = el as OverpassWay;
    if (!way.geometry || way.geometry.length < 3) continue;

    const polygon: [number, number][] = way.geometry.map((pt) => [pt.lat, pt.lon]);

    // Simplify if too many vertices
    const simplified = polygon.length > 8
      ? simplifyPolygon(polygon)
      : polygon;

    const tags = way.tags ?? {};
    const type = inferBuildingType(tags);
    const material = inferMaterial(tags, type);
    const levels = parseInt(tags['building:levels'] ?? (type === 'commercial' ? '2' : '1'), 10) || 1;
    const area = polygonArea(simplified);
    const centroid = computeCentroid(simplified);

    buildings.push({
      id: `b${way.id}`,
      centroid,
      polygon: simplified,
      type,
      levels,
      material,
      area_sqm: Math.round(area),
    });
  }

  return buildings;
}

function simplifyPolygon(polygon: [number, number][]): [number, number][] {
  const min_lat = Math.min(...polygon.map((p) => p[0]));
  const max_lat = Math.max(...polygon.map((p) => p[0]));
  const min_lng = Math.min(...polygon.map((p) => p[1]));
  const max_lng = Math.max(...polygon.map((p) => p[1]));

  return [
    [min_lat, min_lng],
    [min_lat, max_lng],
    [max_lat, max_lng],
    [max_lat, min_lng],
  ];
}

export async function fetchRoads(
  lat: number,
  lng: number,
  radius: number
): Promise<Road[]> {
  const query = `
[out:json][timeout:25];
(
  way["highway"~"primary|secondary|tertiary|residential|unclassified"](around:${radius},${lat},${lng});
);
out body geom;
  `.trim();

  const data = await queryOverpass(query);
  const roads: Road[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way') continue;
    const way = el as OverpassWay;
    if (!way.geometry || way.geometry.length < 2) continue;

    const tags = way.tags ?? {};
    roads.push({
      id: `r${way.id}`,
      name: tags['name'] ?? tags['ref'] ?? 'Unnamed Road',
      geometry: way.geometry.map((pt) => [pt.lat, pt.lon] as [number, number]),
      type: tags['highway'] ?? 'residential',
    });
  }

  return roads;
}

export async function fetchInfrastructure(
  lat: number,
  lng: number,
  radius: number
): Promise<Infrastructure[]> {
  const query = `
[out:json][timeout:25];
(
  node["amenity"~"hospital|school|fire_station|shelter|community_centre"](around:${radius},${lat},${lng});
  way["amenity"~"hospital|school|fire_station|shelter|community_centre"](around:${radius},${lat},${lng});
);
out body geom;
  `.trim();

  const data = await queryOverpass(query);
  const infra: Infrastructure[] = [];

  for (const el of data.elements) {
    const tags = (el as OverpassNode | OverpassWay).tags ?? {};
    const amenity = tags['amenity'] ?? '';

    let position: { lat: number; lng: number };
    if (el.type === 'node') {
      position = { lat: (el as OverpassNode).lat, lng: (el as OverpassNode).lon };
    } else {
      const way = el as OverpassWay;
      if (!way.geometry || way.geometry.length === 0) continue;
      const poly: [number, number][] = way.geometry.map((p) => [p.lat, p.lon]);
      position = computeCentroid(poly);
    }

    infra.push({
      id: `i${el.id}`,
      type: amenity,
      name: tags['name'] ?? amenity,
      position,
      capacity: tags['capacity'] ? parseInt(tags['capacity'], 10) : undefined,
    });
  }

  return infra;
}
