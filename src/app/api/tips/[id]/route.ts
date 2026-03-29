import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import { getAuthUser } from '@/lib/auth';
import { deleteTipForUser } from '@/lib/db/tips';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();
  const Tip = mongoose.models.Tip;
  if (!Tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tip);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(_req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await deleteTipForUser(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: 'Flare not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
