import sharp from 'sharp';

const BASE = 'https://maps.googleapis.com/maps/api/streetview';

export interface StreetViewImage {
  heading: number;
  buffer: Buffer;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface PanoMeta {
  panoId: string;
  lat: number;
  lng: number;
}

/**
 * Resolve Street View metadata for a location.
 * Returns null when Google has no imagery at that point.
 */
export async function getStreetViewMeta(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<PanoMeta | null> {
  const res = await fetch(
    `${BASE}/metadata?location=${lat},${lng}&key=${apiKey}`,
  );
  const json = await res.json();
  if (json.status !== 'OK') return null;
  return {
    panoId: json.pano_id as string,
    lat:    (json.location?.lat as number) ?? lat,
    lng:    (json.location?.lng as number) ?? lng,
  };
}

// ─── Static API images ────────────────────────────────────────────────────────

async function fetchOne(
  lat: number,
  lng: number,
  heading: number,
  fov: number,
  apiKey: string,
): Promise<StreetViewImage> {
  const url =
    `${BASE}?size=640x640&location=${lat},${lng}` +
    `&heading=${heading}&fov=${fov}&pitch=5&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Street View fetch failed heading=${heading}: ${res.status}`);
  return { heading, buffer: Buffer.from(await res.arrayBuffer()) };
}

/**
 * Fetch 4 focused Street View images centered on `centerHeading`.
 * Images are spaced 30° apart (±45° arc) with FOV=60 so they all overlap
 * on the same geometry — exactly what World Labs needs for good reconstruction.
 *
 * Defaults to heading=0 (north-facing). Pass the heading toward the nearest
 * building for best results.
 */
export async function fetchStreetViewImages(
  lat: number,
  lng: number,
  centerHeading = 0,
): Promise<StreetViewImage[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const meta = await getStreetViewMeta(lat, lng, apiKey);
  if (!meta) return [];

  // 4 headings at 30° intervals centred on the subject, FOV=60
  const offsets = [-45, -15, 15, 45];
  const headings = offsets.map((o) => (centerHeading + o + 360) % 360);

  return Promise.all(headings.map((h) => fetchOne(lat, lng, h, 60, apiKey)));
}

// ─── Panorama via tile stitching ──────────────────────────────────────────────

// zoom=2 → 4 columns × 2 rows of 512×512 tiles → 2048×1024 equirectangular
const PANO_ZOOM  = 2;
const TILE_SIZE  = 512;
const PANO_COLS  = 4;
const PANO_ROWS  = 2;
const PANO_W     = PANO_COLS * TILE_SIZE; // 2048
const PANO_H     = PANO_ROWS * TILE_SIZE; // 1024

async function fetchTile(panoId: string, x: number, y: number): Promise<Buffer> {
  const url =
    `https://streetviewpixels-pa.googleapis.com/v1/tile` +
    `?cb_client=maps_sv.tactile&panoid=${panoId}&x=${x}&y=${y}&zoom=${PANO_ZOOM}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tile fetch failed x=${x} y=${y}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Fetch and stitch a full equirectangular panorama (2048×1024) from Street View
 * tile API. Returns null when there is no coverage.
 *
 * The stitched image can be passed to World Labs with is_pano=true, which skips
 * their internal pano-generation step and produces higher-quality results.
 */
export async function fetchStreetViewPanorama(
  lat: number,
  lng: number,
): Promise<{ buffer: Buffer; panoId: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');

  const meta = await getStreetViewMeta(lat, lng, apiKey);
  if (!meta) return null;

  // Fetch all tiles in parallel
  const tileJobs: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < PANO_ROWS; y++) {
    for (let x = 0; x < PANO_COLS; x++) {
      tileJobs.push({ x, y });
    }
  }

  const tiles = await Promise.all(
    tileJobs.map(async ({ x, y }) => ({
      x,
      y,
      buffer: await fetchTile(meta.panoId, x, y),
    })),
  );

  // Stitch into a single equirectangular JPEG using sharp
  const composites = tiles.map(({ x, y, buffer }) => ({
    input: buffer,
    left:  x * TILE_SIZE,
    top:   y * TILE_SIZE,
  }));

  const stitched = await sharp({
    create: { width: PANO_W, height: PANO_H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer: stitched, panoId: meta.panoId };
}
