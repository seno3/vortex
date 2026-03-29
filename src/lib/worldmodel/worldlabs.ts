const API = 'https://api.worldlabs.ai/marble/v1';

export type MarbleModel = 'Marble 0.1-plus' | 'Marble 0.1-mini';

export interface WorldLabsConfig {
  apiKey: string;
  model?: MarbleModel;
}

export interface GeneratedWorld {
  worldId: string;
  marbleUrl: string;
  splatUrls: {
    full_res: string;
    '500k': string;
    '100k': string;
  };
  thumbnailUrl: string;
  panoUrl: string;
  caption: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', 'WLT-Api-Key': apiKey };
}

/** Poll an operation until done (or throw on error). */
async function pollOperation(
  operationId: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
): Promise<Record<string, unknown>> {
  while (true) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(`${API}/operations/${operationId}`, {
      headers: { 'WLT-Api-Key': apiKey },
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const data = await res.json();

    if (data.done) {
      if (data.error) throw new Error(`World generation error: ${JSON.stringify(data.error)}`);
      return data.response as Record<string, unknown>;
    }

    const desc: string =
      data.metadata?.progress?.description ?? data.metadata?.state ?? 'Generating world model…';
    onProgress?.(desc);
  }
}

/** Extract the GeneratedWorld from a completed operation response. */
function parseResponse(resp: Record<string, unknown>): GeneratedWorld {
  const assets = resp.assets as Record<string, unknown>;
  const splats = assets.splats as Record<string, unknown>;
  const spzUrls = splats.spz_urls as { full_res: string; '500k': string; '100k': string };
  const imagery = assets.imagery as Record<string, unknown>;

  return {
    worldId:      String(resp.world_id ?? ''),
    marbleUrl:    String(resp.world_marble_url ?? ''),
    splatUrls:    spzUrls,
    thumbnailUrl: String(assets.thumbnail_url ?? ''),
    panoUrl:      String(imagery?.pano_url ?? ''),
    caption:      String(assets.caption ?? ''),
  };
}

// ─── Upload a single image and return its media_asset_id ─────────────────────

async function uploadImage(
  imageBuffer: Buffer,
  heading: number,
  apiKey: string,
): Promise<string> {
  const prepRes = await fetch(`${API}/media-assets:prepare_upload`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      file_name: `streetview_${heading}.jpg`,
      kind: 'image',
      extension: 'jpg',
    }),
  });
  if (!prepRes.ok) throw new Error(`Prepare upload failed: ${prepRes.status} ${await prepRes.text()}`);
  const prepData = await prepRes.json();

  const mediaAssetId: string = prepData.media_asset.media_asset_id;
  const uploadUrl: string = prepData.upload_info.upload_url;

  // Merge any headers the API requires alongside the upload URL
  const extraHeaders: Record<string, string> = prepData.upload_info.required_headers ?? {};

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
      ...extraHeaders,
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '');
    throw new Error(`Image upload failed: ${uploadRes.status} ${body}`);
  }

  return mediaAssetId;
}

// ─── Upload a video and return its media_asset_id ────────────────────────────

async function uploadVideo(videoBuffer: Buffer, apiKey: string): Promise<string> {
  const prepRes = await fetch(`${API}/media-assets:prepare_upload`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      file_name: 'streetview_pano.mp4',
      kind: 'video',
      extension: 'mp4',
    }),
  });
  if (!prepRes.ok) throw new Error(`Prepare video upload failed: ${prepRes.status} ${await prepRes.text()}`);
  const prepData = await prepRes.json();

  const mediaAssetId: string = prepData.media_asset.media_asset_id;
  const uploadUrl: string = prepData.upload_info.upload_url;
  const extraHeaders: Record<string, string> = prepData.upload_info.required_headers ?? {};

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', ...extraHeaders },
    body: new Uint8Array(videoBuffer),
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '');
    throw new Error(`Video upload failed: ${uploadRes.status} ${body}`);
  }

  return mediaAssetId;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a Gaussian splat from a single stitched equirectangular panorama.
 * Passing is_pano=true tells World Labs to skip their internal pano-generation
 * step and go straight to world reconstruction — better quality, fewer credits.
 */
export async function generateWorldFromPanorama(
  panoBuffer: Buffer,
  config: WorldLabsConfig,
  displayName: string,
  onProgress?: (status: string) => void,
): Promise<GeneratedWorld> {
  const { apiKey, model = 'Marble 0.1-mini' } = config;

  onProgress?.('Uploading panorama…');
  const mediaAssetId = await uploadImage(panoBuffer, 0, apiKey);

  onProgress?.('Submitting world generation request…');
  const genRes = await fetch(`${API}/worlds:generate`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      display_name: `Vortex - ${displayName}`,
      model,
      world_prompt: {
        type: 'multi-image',
        multi_image_prompt: [
          {
            is_pano: true,
            content: {
              source: 'media_asset',
              media_asset_id: mediaAssetId,
            },
          },
        ],
      },
    }),
  });
  if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status} ${await genRes.text()}`);

  const genData = await genRes.json();
  onProgress?.('Generating 3D world model…');
  const response = await pollOperation(genData.operation_id, apiKey, onProgress);
  return parseResponse(response);
}

/**
 * Generate a Gaussian splat from Street View images.
 * No damage/tornado text prompt — we want the real, undamaged location.
 */
export async function generateWorldFromImages(
  images: { buffer: Buffer; heading: number }[],
  config: WorldLabsConfig,
  displayName: string,
  onProgress?: (status: string) => void,
): Promise<GeneratedWorld> {
  const { apiKey, model = 'Marble 0.1-mini' } = config;

  onProgress?.('Uploading Street View imagery…');

  const uploadedImages = await Promise.all(
    images.map(async (img) => ({
      heading: img.heading,
      mediaAssetId: await uploadImage(img.buffer, img.heading, apiKey),
    })),
  );

  onProgress?.('Submitting world generation request…');

  const genRes = await fetch(`${API}/worlds:generate`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      display_name: `Vortex - ${displayName}`,
      model,
      world_prompt: {
        type: 'multi-image',
        multi_image_prompt: uploadedImages.map((img) => ({
          azimuth: img.heading,
          content: {
            source: 'media_asset',
            media_asset_id: img.mediaAssetId,
          },
        })),
        // No tornado/damage prompt — show the real, undamaged location.
        // Damage is communicated exclusively through agent labels in the scene.
      },
    }),
  });
  if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status} ${await genRes.text()}`);

  const genData = await genRes.json();

  onProgress?.('Generating 3D world model (this takes ~30-60 seconds)…');
  const response = await pollOperation(genData.operation_id, apiKey, onProgress);

  return parseResponse(response);
}

/**
 * Generate a Gaussian splat from a panoramic MP4 video.
 * The video should be a smooth 360° sweep of Street View frames — this gives
 * World Labs temporal parallax information for higher-quality reconstruction
 * compared to 4 static images.
 */
export async function generateWorldFromVideo(
  videoBuffer: Buffer,
  config: WorldLabsConfig,
  displayName: string,
  onProgress?: (status: string) => void,
): Promise<GeneratedWorld> {
  const { apiKey, model = 'Marble 0.1-mini' } = config;

  onProgress?.('Uploading panoramic video…');
  const mediaAssetId = await uploadVideo(videoBuffer, apiKey);

  onProgress?.('Submitting world generation request…');
  const genRes = await fetch(`${API}/worlds:generate`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      display_name: `Vortex - ${displayName}`,
      model,
      world_prompt: {
        type: 'video',
        video_prompt: {
          content: {
            source: 'media_asset',
            media_asset_id: mediaAssetId,
          },
        },
      },
    }),
  });
  if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status} ${await genRes.text()}`);

  const genData = await genRes.json();

  onProgress?.('Generating 3D world model (this takes ~30-60 seconds)…');
  const response = await pollOperation(genData.operation_id, apiKey, onProgress);

  return parseResponse(response);
}

/**
 * Generate a world from a text description (fallback when Street View has no coverage).
 * Uses a neutral scene description — no damage imagery.
 */
export async function generateWorldFromText(
  locationName: string,
  config: WorldLabsConfig,
  onProgress?: (status: string) => void,
): Promise<GeneratedWorld> {
  const { apiKey, model = 'Marble 0.1-mini' } = config;

  onProgress?.('No Street View coverage. Generating from description…');

  const genRes = await fetch(`${API}/worlds:generate`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      display_name: `Vortex - ${locationName}`,
      model,
      world_prompt: {
        type: 'text',
        text_prompt: `A residential neighborhood street in ${locationName}, showing houses, roads, and trees on a clear day`,
      },
    }),
  });
  if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status} ${await genRes.text()}`);

  const genData = await genRes.json();

  onProgress?.('Generating 3D world model…');
  const response = await pollOperation(genData.operation_id, apiKey, onProgress);

  return parseResponse(response);
}
