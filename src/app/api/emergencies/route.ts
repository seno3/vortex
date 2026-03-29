import { NextResponse } from 'next/server';
import { getActiveEmergency, createEmergency, clearActiveEmergencies } from '@/lib/db/emergencies';
import type { EmergencyType } from '@/types';

export async function GET() {
  const emergency = await getActiveEmergency();
  if (!emergency) return NextResponse.json({ emergency: null });

  return NextResponse.json({
    emergency: {
      id: String(emergency._id),
      type: emergency.type,
      active: emergency.active,
      lat: emergency.lat,
      lng: emergency.lng,
      address: emergency.address,
      createdAt: emergency.createdAt.toISOString(),
    },
  });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }
  const { type, lat, lng, address } = await req.json() as {
    type: EmergencyType; lat: number; lng: number; address?: string;
  };
  const emergency = await createEmergency({ type, lat, lng, address });
  return NextResponse.json({ id: String(emergency._id) }, { status: 201 });
}

export async function DELETE() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }
  await clearActiveEmergencies();
  return NextResponse.json({ ok: true });
}
