import { NextRequest, NextResponse } from 'next/server';
import { getExitsForBuilding, getExitsInArea, createExit } from '@/lib/db/exits';
import { getAuthUser } from '@/lib/auth';
import type { Exit } from '@/types';

function iexitToExit(doc: any): Exit {
  return {
    _id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : undefined,
    buildingId: doc.buildingId,
    location: {
      lat: doc.location.coordinates[1],
      lng: doc.location.coordinates[0],
    },
    exitType: doc.exitType,
    floor: doc.floor,
    description: doc.description,
    accessible: doc.accessible,
    status: doc.status,
    source: 'community',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const buildingId = searchParams.get('buildingId');
  const lngParam = searchParams.get('lng');
  const latParam = searchParams.get('lat');
  const radiusParam = searchParams.get('radius');

  const lng = lngParam ? parseFloat(lngParam) : null;
  const lat = latParam ? parseFloat(latParam) : null;
  const radius = radiusParam ? parseFloat(radiusParam) : 300;

  try {
    if (lng !== null && lat !== null && isFinite(lng) && isFinite(lat)) {
      const docs = await getExitsInArea(lng, lat, radius);
      let exits = docs.map(iexitToExit);
      if (buildingId) exits = exits.filter((e) => e.buildingId === buildingId);
      return NextResponse.json({ exits });
    } else if (buildingId) {
      const docs = await getExitsForBuilding(buildingId);
      return NextResponse.json({ exits: docs.map(iexitToExit) });
    } else {
      return NextResponse.json({ error: 'Provide lng+lat or buildingId' }, { status: 400 });
    }
  } catch (err) {
    console.error('[GET /api/exits]', err);
    return NextResponse.json({ exits: [] });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { buildingId, location, exitType, floor, description, accessible } = body;

    if (!buildingId || !location?.lng || !location?.lat || !exitType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const exit = await createExit({
      userId,
      buildingId,
      lng: location.lng,
      lat: location.lat,
      exitType,
      floor: floor ?? 0,
      description,
      accessible: accessible ?? false,
    });

    const result: Exit = {
      _id: String(exit._id),
      userId,
      buildingId: exit.buildingId,
      location: {
        lat: exit.location.coordinates[1],
        lng: exit.location.coordinates[0],
      },
      exitType: exit.exitType,
      floor: exit.floor,
      description: exit.description,
      accessible: exit.accessible,
      status: exit.status,
      source: 'community',
      createdAt: exit.createdAt.toISOString(),
    };

    return NextResponse.json({ exit: result }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/exits]', err);
    return NextResponse.json({ error: 'Failed to create exit' }, { status: 500 });
  }
}
