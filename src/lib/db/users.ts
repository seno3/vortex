import mongoose, { Schema, Document, Model } from 'mongoose';
import { connectDB } from './mongodb';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
  credibilityScore: number;
  tipsSubmitted: number;
  /** Number of flares this user has upvoted (others’ tips). */
  tipsCorroborated: number;
  tipsFlagged: number;
}

const userSchema = new Schema<IUser>({
  username:        { type: String, required: true, unique: true },
  passwordHash:    { type: String, required: true },
  createdAt:       { type: Date, default: Date.now },
  credibilityScore: { type: Number, default: 50 },
  tipsSubmitted:   { type: Number, default: 0 },
  tipsCorroborated: { type: Number, default: 0 },
  tipsFlagged:     { type: Number, default: 0 },
});

function getUserModel(): Model<IUser> {
  return mongoose.models.User as Model<IUser> || mongoose.model<IUser>('User', userSchema);
}

export async function createUser(username: string, passwordHash: string): Promise<IUser> {
  await connectDB();
  return getUserModel().create({ username, passwordHash });
}

export async function findByUsername(username: string): Promise<IUser | null> {
  await connectDB();
  return getUserModel().findOne({ username });
}

export async function findById(id: string): Promise<IUser | null> {
  await connectDB();
  return getUserModel().findById(id);
}

export async function incrementTipsSubmitted(userId: string): Promise<void> {
  await connectDB();
  await getUserModel().findByIdAndUpdate(userId, { $inc: { tipsSubmitted: 1 } });
}

/** One count per successful upvote on someone else's flare (shown on account as corroborations). */
export async function incrementTipsCorroborated(userId: string): Promise<void> {
  await connectDB();
  await getUserModel().findByIdAndUpdate(userId, { $inc: { tipsCorroborated: 1 } });
}

export async function updateCredibility(userId: string, delta: number): Promise<void> {
  await connectDB();
  const user = await getUserModel().findById(userId);
  if (!user) return;
  user.credibilityScore = Math.max(0, Math.min(100, user.credibilityScore + delta));
  await user.save();
}
