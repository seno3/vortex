import mongoose, { Schema, Document } from 'mongoose';
import { connectDB } from './mongodb';
import type { ExitType, ExitStatus } from '@/types';

export interface IExit extends Document {
  userId: mongoose.Types.ObjectId;
  buildingId: string;
  location: { type: string; coordinates: [number, number] };
  exitType: ExitType;
  floor: number;
  description?: string;
  accessible: boolean;
  status: ExitStatus;
  createdAt: Date;
  updatedAt: Date;
}

const exitSchema = new Schema<IExit>({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  buildingId: { type: String, required: true },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  exitType:    { type: String, enum: ['main', 'side', 'emergency', 'fire_escape', 'service', 'staircase'], required: true },
  floor:       { type: Number, default: 0 },
  description: { type: String, maxlength: 150 },
  accessible:  { type: Boolean, default: false },
  status:      { type: String, enum: ['active', 'blocked', 'locked'], default: 'active' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

exitSchema.index({ location: '2dsphere' });
exitSchema.index({ buildingId: 1 });

const ExitModel: mongoose.Model<IExit> =
  mongoose.models.Exit || mongoose.model<IExit>('Exit', exitSchema);

export async function createExit(data: {
  userId: string;
  buildingId: string;
  lng: number;
  lat: number;
  exitType: ExitType;
  floor?: number;
  description?: string;
  accessible?: boolean;
}): Promise<IExit> {
  await connectDB();
  const exit = new ExitModel({
    userId: new mongoose.Types.ObjectId(data.userId),
    buildingId: data.buildingId,
    location: { type: 'Point', coordinates: [data.lng, data.lat] },
    exitType: data.exitType,
    floor: data.floor ?? 0,
    description: data.description,
    accessible: data.accessible ?? false,
    status: 'active',
  });
  return exit.save();
}

export async function getExitsForBuilding(buildingId: string): Promise<IExit[]> {
  await connectDB();
  return ExitModel.find({ buildingId }).sort({ createdAt: -1 }).lean() as unknown as IExit[];
}

export async function getExitsInArea(
  lng: number,
  lat: number,
  radiusMeters: number,
): Promise<IExit[]> {
  await connectDB();
  return ExitModel.find({
    location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    },
  })
    .limit(200)
    .lean() as unknown as IExit[];
}

export async function updateExitStatus(
  exitId: string,
  status: ExitStatus,
): Promise<IExit | null> {
  await connectDB();
  return ExitModel.findByIdAndUpdate(
    exitId,
    { status, updatedAt: new Date() },
    { new: true },
  ).lean() as unknown as IExit | null;
}
