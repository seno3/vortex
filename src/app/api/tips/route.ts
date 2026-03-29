import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createTip, FLARE_LIFETIME_MS, formatTipForClient, getTipsInArea } from '@/lib/db/tips';
import { findById, incrementTipsSubmitted } from '@/lib/db/users';
import { processTip } from '@/lib/agents/orchestrator';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lng = parseFloat(searchParams.get('lng') ?? '0');
  const lat = parseFloat(searchParams.get('lat') ?? '0');
  const radius = parseFloat(searchParams.get('radius') ?? '1609');
  const viewerId = await getAuthUser(req);
  const tips = await getTipsInArea(lng, lat, radius);
  const payload = tips.map((t) => formatTipForClient(t, viewerId));
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { lng, lat, buildingId, category, description, urgency } = body;

  const user = await findById(userId);
  const credibilityScore = user?.credibilityScore ?? 50;

  const expiresAt = new Date(Date.now() + FLARE_LIFETIME_MS);

  const tip = await createTip({
    userId,
    location: [lng, lat],
    buildingId,
    category,
    description,
    urgency: urgency ?? 'medium',
    credibilityScore,
    expiresAt,
  });

  // Increment user's tip counter and process async — don't block the response
  incrementTipsSubmitted(userId).catch(console.error);
  processTip(tip).catch(console.error);

  return NextResponse.json(formatTipForClient(tip, userId), { status: 201 });
}
