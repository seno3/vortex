import * as fs from 'fs';
import * as path from 'path';
import { fetchStreetViewPanorama, fetchStreetViewImages } from './streetview';
import {
  generateWorldFromPanorama,
  generateWorldFromImages,
  generateWorldFromText,
  GeneratedWorld,
  WorldLabsConfig,
} from './worldlabs';

// ─── Disk cache ────────────────────────────────────────────────────────────────
// Splats are saved to public/splats/ so Next.js serves them as static files.
// A companion .json file stores the GeneratedWorld metadata for full restoration.

const SPLATS_DIR = path.join(process.cwd(), 'public', 'splats');

function diskKey(lat: number, lng: number) {
  return `${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

function splatPath(key: string)  { return path.join(SPLATS_DIR, `${key}.spz`); }
function metaPath(key: string)   { return path.join(SPLATS_DIR, `${key}.json`); }
function localUrl(key: string)   { return `/splats/${key}.spz`; }

function loadFromDisk(key: string): GeneratedWorld | null {
  const sp = splatPath(key);
  const mp = metaPath(key);
  if (!fs.existsSync(sp) || !fs.existsSync(mp)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(mp, 'utf8')) as GeneratedWorld;
    // Override all splat URLs to point at the local static file
    meta.splatUrls = { full_res: localUrl(key), '500k': localUrl(key), '100k': localUrl(key) };
    return meta;
  } catch {
    return null;
  }
}

async function saveToDisk(key: string, world: GeneratedWorld): Promise<GeneratedWorld> {
  fs.mkdirSync(SPLATS_DIR, { recursive: true });

  // Pick the best available splat URL
  const cdnUrl =
    world.splatUrls['500k'] ??
    world.splatUrls['100k'] ??
    world.splatUrls['full_res'];

  // Download the .spz from World Labs CDN
  const res = await fetch(cdnUrl);
  if (!res.ok) throw new Error(`Failed to download splat: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(splatPath(key), buf);

  // Save metadata (without the CDN URLs — we'll reconstruct local ones on load)
  const meta: GeneratedWorld = { ...world, splatUrls: { full_res: '', '500k': '', '100k': '' } };
  fs.writeFileSync(metaPath(key), JSON.stringify(meta, null, 2));

  // Return world with local URL
  return {
    ...world,
    splatUrls: { full_res: localUrl(key), '500k': localUrl(key), '100k': localUrl(key) },
  };
}

// ─── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Full pipeline: Street View → World Labs Marble 0.1-plus → GeneratedWorld.
 *
 * Checks public/splats/{lat}_{lng}.spz on every call — if it exists the World
 * Labs API is never called. Generated splats are downloaded and saved there
 * automatically so they persist across server restarts.
 *
 * Strategy (best to worst quality):
 *   1. Stitched equirectangular panorama → is_pano=true  (best)
 *   2. 4 focused images at 30° intervals, FOV=60         (good)
 *   3. Text description fallback                          (no coverage)
 */
export async function generateWorldForLocation(
  lat: number,
  lng: number,
  locationName: string,
  onProgress?: (stage: string, detail: string) => void,
): Promise<GeneratedWorld> {
  const key = diskKey(lat, lng);

  // Wrap onProgress so a disconnected SSE stream never aborts the pipeline.
  const progress = (stage: string, detail: string) => {
    try { onProgress?.(stage, detail); } catch { /* client disconnected */ }
  };

  // ── Disk cache hit ────────────────────────────────────────────────────────
  const cached = loadFromDisk(key);
  if (cached) {
    progress('cache', 'World model loaded from cache');
    return cached;
  }

  const apiKey = process.env.WORLDLABS_API_KEY;
  if (!apiKey) throw new Error('WORLDLABS_API_KEY is not set');

  const config: WorldLabsConfig = { apiKey, model: 'Marble 0.1-plus' };

  let world: GeneratedWorld;

  // ── Strategy 1: Equirectangular panorama (is_pano) ────────────────────────
  progress('streetview', 'Fetching Street View panorama…');
  try {
    const pano = await fetchStreetViewPanorama(lat, lng);
    if (pano) {
      progress('worldgen', 'Submitting equirectangular panorama…');
      world = await generateWorldFromPanorama(
        pano.buffer,
        config,
        locationName,
        (status) => progress('worldgen', status),
      );
      const saved = await saveToDisk(key, world);
      progress('complete', 'World model ready');
      return saved;
    }
  } catch (err) {
    console.warn('[pipeline] Panorama strategy failed, trying focused images:', err);
  }

  // ── Strategy 2: 4 focused images at 30° intervals, FOV=60 ────────────────
  progress('streetview', 'Fetching focused Street View imagery…');
  try {
    const images = await fetchStreetViewImages(lat, lng);
    if (images.length > 0) {
      progress('worldgen', 'Building 3D world model from focused imagery…');
      world = await generateWorldFromImages(
        images,
        config,
        locationName,
        (status) => progress('worldgen', status),
      );
      const saved = await saveToDisk(key, world);
      progress('complete', 'World model ready');
      return saved;
    }
  } catch (err) {
    console.warn('[pipeline] Focused images strategy failed, falling back to text:', err);
  }

  // ── Strategy 3: Text fallback ─────────────────────────────────────────────
  progress('worldgen', 'No Street View coverage — generating from description…');
  world = await generateWorldFromText(
    locationName,
    config,
    (status) => progress('worldgen', status),
  );
  const saved = await saveToDisk(key, world);
  progress('complete', 'World model ready');
  return saved;
}
