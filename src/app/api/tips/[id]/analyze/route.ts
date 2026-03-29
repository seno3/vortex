import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import { processTip } from '@/lib/agents/orchestrator';
import type { ITip } from '@/lib/db/tips';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();
  const Tip = mongoose.models.Tip;
  if (!Tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const tip = await Tip.findById(id);
  if (!tip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fire pipeline async — don't block
  processTip(tip as ITip).catch(console.error);

  return NextResponse.json({ ok: true });
}
