import { generateWorldForLocation } from '@/lib/worldmodel/pipeline';

export const maxDuration = 300; // 5-minute timeout for world generation

export async function POST(req: Request) {
  const { lat, lng, locationName } = await req.json();

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return new Response(JSON.stringify({ error: 'lat and lng are required numbers' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!process.env.WORLDLABS_API_KEY) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: 'WORLDLABS_API_KEY is not configured' })}\n\n`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Client disconnected — keep the pipeline running so the splat is saved to disk
        }
      };

      try {
        const world = await generateWorldForLocation(
          lat,
          lng,
          locationName ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          (stage, detail) => send('progress', { stage, detail }),
        );

        // splatUrls now point at /splats/*.spz (local static files) after disk caching.
        // CDN URLs are only present if saveToDisk failed, in which case proxy them.
        const rawUrl =
          world.splatUrls['500k'] ??
          world.splatUrls['100k'] ??
          world.splatUrls['full_res'];
        const splatUrl = rawUrl.startsWith('/')
          ? rawUrl
          : `/api/splat-proxy?url=${encodeURIComponent(rawUrl)}`;

        send('complete', {
          splatUrl,
          worldId:      world.worldId,
          marbleUrl:    world.marbleUrl,
          thumbnailUrl: world.thumbnailUrl,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[generate-world]', message);
        send('error', { message });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
