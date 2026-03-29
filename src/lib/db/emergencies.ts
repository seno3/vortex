import mongoose, { Schema, Document, Model } from 'mongoose';
import { connectDB } from './mongodb';
import type { EmergencyType } from '@/types';

export interface IEmergency extends Document {
  type: EmergencyType;
  active: boolean;
  lat: number;
  lng: number;
  address?: string;
  createdAt: Date;
}

const emergencySchema = new Schema<IEmergency>({
  type:    { type: String, required: true },
  active:  { type: Boolean, default: true },
  lat:     { type: Number, required: true },
  lng:     { type: Number, required: true },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
});

function getModel(): Model<IEmergency> {
  return mongoose.models.Emergency as Model<IEmergency>
    || mongoose.model<IEmergency>('Emergency', emergencySchema);
}

export async function getActiveEmergency(): Promise<IEmergency | null> {
  await connectDB();
  return getModel().findOne({ active: true }).sort({ createdAt: -1 }).lean() as Promise<IEmergency | null>;
}

export async function createEmergency(data: {
  type: EmergencyType;
  lat: number;
  lng: number;
  address?: string;
}): Promise<IEmergency> {
  await connectDB();
  return getModel().create({ ...data, active: true });
}

export async function clearActiveEmergencies(): Promise<void> {
  await connectDB();
  await getModel().updateMany({ active: true }, { active: false });
}
