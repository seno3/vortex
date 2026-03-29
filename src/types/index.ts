// ─── OSM / Town model (kept for geocoding pipeline) ──────────────────────────
export interface Building {
  id: string;
  centroid: { lat: number; lng: number };
  polygon: [number, number][];
  type: string;
  levels: number;
  material: string;
  area_sqm: number;
}

export interface Road {
  id: string;
  name: string;
  geometry: [number, number][];
  type: string;
}

export interface Infrastructure {
  id: string;
  type: string;
  name: string;
  position: { lat: number; lng: number };
  capacity?: number;
}

export interface WaterFeature {
  id: string;
  type: string;
  kind?: string;
  category?: string;
  name?: string;
  geometry: [number, number][];
  [key: string]: unknown;
}

export interface TownModel {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  buildings: Building[];
  roads: Road[];
  infrastructure: Infrastructure[];
  population_estimate: number;
  // Legacy fields used in fallback data
  queryRadiusM?: number;
  groundRadiusM?: number;
  waterFeatures?: WaterFeature[];
}

// ─── Agent analysis receipt ───────────────────────────────────────────────────
export interface AgentAnalysis {
  classifier?: {
    category: string;
    threatLevel: string;
    credibility: number;
    sourceType: string[];
    decayMinutes: number;
    reasoning: string;
    completedAt: string;
  };
  corroborator?: {
    confidence: number;
    corroboratingTips: Array<{ tipId: string; timeOffsetMs: number }>;
    contradictions: number;
    isEscalation: boolean;
    reasoning: string;
    completedAt: string;
  };
  synthesizer?: {
    summary: string;
    affectedArea: string;
    confidence: number;
    keyFacts: string[];
    completedAt: string;
  };
  recommender?: {
    actions: Array<{ type: string; instruction: string }>;
    exitsUsed: number;
    reasoning: string;
    completedAt: string;
  };
  totalProcessingMs?: number;
  agentsRun?: number;
}

// ─── Vigil domain types ───────────────────────────────────────────────────────
export interface User {
  _id: string;
  username: string;
  credibilityScore: number;
  tipsSubmitted: number;
  tipsCorroborated: number;
  tipsFlagged: number;
}

export type TipCategory = 'active_threat' | 'weather' | 'infrastructure' | 'general_safety';
export type TipUrgency  = 'low' | 'medium' | 'high' | 'critical';
export type TipStatus   = 'pending' | 'corroborated' | 'escalated' | 'resolved' | 'flagged';
export type ThreatLevel = 'advisory' | 'warning' | 'critical';

export interface Tip {
  _id: string;
  userId: string;
  location: { type: 'Point'; coordinates: [number, number] };
  buildingId?: string;
  category: TipCategory;
  description: string;
  urgency: TipUrgency;
  credibilityScore: number;
  /** Distinct users who upvoted this flare (server may omit raw ids; use upvoteCount / hasUpvoted). */
  upvoteCount?: number;
  hasUpvoted?: boolean;
  status: TipStatus;
  agentAnalysis?: AgentAnalysis;
  createdAt: string;
  expiresAt: string;
}

export interface ThreatState {
  buildingId: string;
  tipCount: number;
  threatLevel: ThreatLevel;
  synthesis?: string;
}

// ─── Exit domain types ────────────────────────────────────────────────────────
export type ExitType = 'main' | 'side' | 'emergency' | 'fire_escape' | 'service' | 'staircase';
export type ExitStatus = 'active' | 'blocked' | 'locked';

export interface Exit {
  _id: string;
  userId?: string;
  buildingId: string;
  location: { lat: number; lng: number };
  exitType: ExitType;
  floor: number;
  description?: string;
  accessible: boolean;
  status: ExitStatus;
  source: 'osm' | 'community';
  createdAt?: string;
}

// ─── Emergency domain types ───────────────────────────────────────────────────
export type EmergencyType = 'shooting' | 'tornado' | 'earthquake' | 'fire';

export interface Emergency {
  id: string;
  type: EmergencyType;
  active: boolean;
  lat: number;
  lng: number;
  address?: string;
  createdAt: string;
}
