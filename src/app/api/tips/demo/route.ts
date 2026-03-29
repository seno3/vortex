import { NextResponse } from 'next/server';
import { createTip, FLARE_LIFETIME_MS } from '@/lib/db/tips';
import { processTip } from '@/lib/agents/orchestrator';

// Demo building in downtown area — triggers full escalation
const DEMO_BUILDING_ID = 'demo-building-001';
const DEMO_LNG = -87.6298;
const DEMO_LAT = 41.8781;

export async function POST() {
  const expiresAt = new Date(Date.now() + FLARE_LIFETIME_MS);
  const demoUserId = '000000000000000000000001';

  const tips = await Promise.all([
    createTip({ userId: demoUserId, location: [DEMO_LNG, DEMO_LAT], buildingId: DEMO_BUILDING_ID, category: 'active_threat', description: 'Suspicious person with large bag entering building, acting erratically', urgency: 'high', credibilityScore: 70, expiresAt }),
    createTip({ userId: '000000000000000000000002', location: [DEMO_LNG + 0.0001, DEMO_LAT + 0.0001], buildingId: DEMO_BUILDING_ID, category: 'active_threat', description: 'Heard loud argument and breaking glass inside building lobby', urgency: 'high', credibilityScore: 65, expiresAt }),
    createTip({ userId: '000000000000000000000003', location: [DEMO_LNG - 0.0001, DEMO_LAT - 0.0001], buildingId: DEMO_BUILDING_ID, category: 'active_threat', description: 'Security guard running out of building, people evacuating from east exit', urgency: 'critical', credibilityScore: 80, expiresAt }),
  ]);

  // Process all three async — they will corroborate and escalate
  for (const tip of tips) {
    processTip(tip).catch(console.error);
  }

  return NextResponse.json({ message: 'Demo tips created', count: tips.length, buildingId: DEMO_BUILDING_ID });
}
