export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response('Missing url param', { status: 400 });
  }

  // Only allow World Labs CDN URLs
  if (!url.startsWith('https://cdn.marble.worldlabs.ai/')) {
    return new Response('Forbidden', { status: 403 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return new Response(`Upstream failed: ${upstream.status}`, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
