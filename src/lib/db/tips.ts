import mongoose, { Schema, Document, Model } from 'mongoose';
import { connectDB } from './mongodb';
import { incrementTipsCorroborated, updateCredibility } from './users';
import type { TipCategory, TipUrgency, TipStatus } from '@/types';

export interface ITip extends Document {
  userId: mongoose.Types.ObjectId;
  location: { type: string; coordinates: [number, number] };
  buildingId?: string;
  category: TipCategory;
  description: string;
  urgency: TipUrgency;
  credibilityScore: number;
  upvotedBy: mongoose.Types.ObjectId[];
  status: TipStatus;
  corroboratingTips: mongoose.Types.ObjectId[];
  contradictingTips: mongoose.Types.ObjectId[];
  agentAnalysis?: { classification: string; threatLevel: string; reasoning: string };
  createdAt: Date;
  expiresAt: Date;
}

const tipSchema = new Schema<ITip>({
  userId:       { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  buildingId:   { type: String },
  category:     { type: String, required: true },
  description:  { type: String, required: true },
  urgency:      { type: String, default: 'medium' },
  credibilityScore: { type: Number, default: 50 },
  upvotedBy:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status:       { type: String, default: 'pending' },
  corroboratingTips: [{ type: Schema.Types.ObjectId, ref: 'Tip' }],
  contradictingTips: [{ type: Schema.Types.ObjectId, ref: 'Tip' }],
  agentAnalysis: {
    classification: String,
    threatLevel:    String,
    reasoning:      String,
  },
  createdAt:    { type: Date, default: Date.now },
  expiresAt:    { type: Date, required: true },
});
tipSchema.index({ location: '2dsphere' });

const UPVOTE_CREDIBILITY_DELTA = 2;
/** Added to the flare author's profile when someone upvotes their flare (capped 0–100 on User). */
const UPVOTE_AUTHOR_CREDIBILITY_DELTA = 1;
const MAX_TIP_CREDIBILITY = 100;

/** Flares stop appearing in feeds / maps after this lifetime from report time. */
export const FLARE_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** Mongo filter: flare still within lifetime (`expiresAt` or legacy `createdAt` window). */
export function buildFlareNotExpiredFilter(): Record<string, unknown> {
  const now = new Date();
  const createdFloor = new Date(Date.now() - FLARE_LIFETIME_MS);
  return {
    $or: [
      { expiresAt: { $gt: now } },
      { expiresAt: { $exists: false }, createdAt: { $gte: createdFloor } },
    ],
  };
}

export function isTipExpired(doc: { expiresAt?: Date; createdAt?: Date }): boolean {
  const now = Date.now();
  if (doc.expiresAt) return new Date(doc.expiresAt).getTime() <= now;
  if (doc.createdAt) return now - new Date(doc.createdAt).getTime() > FLARE_LIFETIME_MS;
  return true;
}

function getTipModel(): Model<ITip> {
  return mongoose.models.Tip as Model<ITip> || mongoose.model<ITip>('Tip', tipSchema);
}

export async function upvoteTip(
  tipId: string,
  voterUserId: string,
): Promise<
  | { ok: true; credibilityScore: number; upvoteCount: number; already: boolean }
  | { ok: false; reason: 'not_found' | 'own_tip' }
> {
  await connectDB();
  const Tip = getTipModel();
  const voterOid = new mongoose.Types.ObjectId(voterUserId);

  const updated = await Tip.findOneAndUpdate(
    {
      $and: [
        { _id: tipId },
        { userId: { $ne: voterOid } },
        buildFlareNotExpiredFilter(),
        {
          $expr: {
            $not: { $in: [voterOid, { $ifNull: ['$upvotedBy', []] }] },
          },
        },
      ],
    },
    {
      $addToSet: { upvotedBy: voterOid },
      $inc: { credibilityScore: UPVOTE_CREDIBILITY_DELTA },
    },
    { new: true },
  );

  if (updated) {
    if (updated.credibilityScore > MAX_TIP_CREDIBILITY) {
      updated.credibilityScore = MAX_TIP_CREDIBILITY;
      await updated.save();
    }
    await updateCredibility(String(updated.userId), UPVOTE_AUTHOR_CREDIBILITY_DELTA);
    incrementTipsCorroborated(voterUserId).catch(console.error);
    const count = updated.upvotedBy?.length ?? 0;
    return { ok: true, credibilityScore: updated.credibilityScore, upvoteCount: count, already: false };
  }

  const tip = await Tip.findById(tipId).lean();
  if (!tip) return { ok: false, reason: 'not_found' };
  if (isTipExpired(tip)) return { ok: false, reason: 'not_found' };
  if (String(tip.userId) === voterUserId) return { ok: false, reason: 'own_tip' };
  const ids = (tip.upvotedBy ?? []).map((id) => String(id));
  if (ids.includes(voterUserId)) {
    return {
      ok: true,
      credibilityScore: tip.credibilityScore,
      upvoteCount: ids.length,
      already: true,
    };
  }
  return { ok: false, reason: 'not_found' };
}

export async function createTip(data: {
  userId: string;
  location: [number, number];
  buildingId?: string;
  category: TipCategory;
  description: string;
  urgency: TipUrgency;
  credibilityScore: number;
  expiresAt: Date;
}): Promise<ITip> {
  await connectDB();
  return getTipModel().create({
    ...data,
    location: { type: 'Point', coordinates: data.location },
    userId: new mongoose.Types.ObjectId(data.userId),
  });
}

export async function getTipsInArea(
  lng: number, lat: number, radiusMeters: number, since?: Date
): Promise<ITip[]> {
  await connectDB();
  const query: Record<string, unknown> = {
    location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusMeters } },
    status: { $nin: ['resolved', 'flagged'] },
  };
  if (since) query.createdAt = { $gte: since };
  return getTipModel().find(query).sort({ createdAt: -1 }).limit(100);
}

/** JSON for API clients — omits raw `upvotedBy`, adds `upvoteCount` and `hasUpvoted`. */
export function formatTipForClient(
  doc: ITip | Record<string, unknown>,
  currentUserId: string | null,
): Record<string, unknown> {
  const o: Record<string, unknown> =
    doc && typeof (doc as ITip).toObject === 'function'
      ? ((doc as ITip).toObject() as Record<string, unknown>)
      : (doc as Record<string, unknown>);
  const raw = o.upvotedBy as unknown[] | undefined;
  const ids = (raw ?? []).map((id) => String(id));
  const createdAt = o.createdAt;
  const expiresAt = o.expiresAt;
  return {
    _id: String(o._id),
    userId: String(o.userId),
    location: o.location,
    buildingId: o.buildingId,
    category: o.category,
    description: o.description,
    urgency: o.urgency,
    credibilityScore: o.credibilityScore,
    status: o.status,
    agentAnalysis: o.agentAnalysis,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
    upvoteCount: ids.length,
    hasUpvoted: Boolean(currentUserId && ids.includes(currentUserId)),
  };
}

export async function getTipsByUser(userId: string): Promise<ITip[]> {
  await connectDB();
  return getTipModel().find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(20);
}

export async function deleteTipForUser(
  tipId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  if (!mongoose.Types.ObjectId.isValid(tipId)) return { ok: false, reason: 'not_found' };
  await connectDB();
  const res = await getTipModel().deleteOne({
    _id: new mongoose.Types.ObjectId(tipId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (res.deletedCount === 0) return { ok: false, reason: 'not_found' };
  return { ok: true };
}

export async function getTipsForBuilding(buildingId: string, since?: Date): Promise<ITip[]> {
  await connectDB();
  const query: Record<string, unknown> = { buildingId, status: { $nin: ['resolved', 'flagged'] } };
  if (since) query.createdAt = { $gte: since };
  return getTipModel().find(query).sort({ createdAt: -1 });
}

export async function updateTipAnalysis(
  tipId: string,
  analysis: { classification: string; threatLevel: string; reasoning: string },
  status: TipStatus,
): Promise<void> {
  await connectDB();
  await getTipModel().findByIdAndUpdate(tipId, { agentAnalysis: analysis, status });
}

export async function getActiveThreatBuildings(): Promise<
  Array<{ buildingId: string; tipCount: number; threatLevel: string }>
> {
  await connectDB();
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const results = await getTipModel().aggregate([
    {
      $match: {
        $and: [
          { category: 'active_threat' },
          { createdAt: { $gte: since } },
          { buildingId: { $exists: true, $ne: null } },
          { status: { $nin: ['resolved', 'flagged'] } },
          buildFlareNotExpiredFilter(),
        ],
      },
    },
    { $group: { _id: '$buildingId', tipCount: { $sum: 1 }, maxUrgency: { $max: '$urgency' } } },
    { $match: { tipCount: { $gte: 2 } } },
  ]);
  return results.map((r) => ({
    buildingId: r._id as string,
    tipCount: r.tipCount as number,
    threatLevel: r.tipCount >= 5 ? 'critical' : r.tipCount >= 3 ? 'warning' : 'advisory',
  }));
}
