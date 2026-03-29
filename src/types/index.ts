export interface Building {
  id: string;
  centroid: { lat: number; lng: number };
  polygon: [number, number][]; // [lat, lng] pairs
  type: string; // residential, commercial, school, hospital
  levels: number;
  material: string; // wood, brick, concrete, steel, unknown
  area_sqm: number;
}

export interface Road {
  id: string;
  name: string;
  geometry: [number, number][]; // [lat, lng] pairs
  type: string; // primary, secondary, residential
}

export interface Infrastructure {
  id: string;
  type: string; // hospital, school, fire_station, shelter
  name: string;
  position: { lat: number; lng: number };
  capacity?: number;
}

export interface TownModel {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  buildings: Building[];
  roads: Road[];
  infrastructure: Infrastructure[];
  population_estimate: number;
}

export type DamageLevel = 'destroyed' | 'major' | 'minor' | 'intact';

export interface PathSegment {
  lat: number;
  lng: number;
  width_m: number;
  wind_speed_mph: number;
}

export interface EvacuationRoute {
  road_ids: string[];
  priority: number;
  geometry?: [number, number][];
}

export interface Deployment {
  type: string;
  location: { lat: number; lng: number };
  reason: string;
}

// Label as returned by AI agents — lat/lng position
export type LabelSeverity = 'critical' | 'warning' | 'evacuation' | 'deployment' | 'info' | 'safe';

export interface Label {
  id: string;
  position: { lat: number; lng: number };
  text: string;
  severity: LabelSeverity;
  details?: string;
}

// Label for 3D scene rendering — converted to Three.js coordinates
export interface SceneLabel {
  id: string;
  position: [number, number, number]; // x, y, z in scene space
  text: string;
  severity: LabelSeverity;
  details?: string;
}

export interface AgentData {
  affected_buildings?: string[];
  damage_levels?: Record<string, DamageLevel>;
  path_segments?: PathSegment[];
  debris_zones?: Array<{ lat: number; lng: number; radius_m: number }>;
  evacuation_routes?: EvacuationRoute[];
  blocked_roads?: string[];
  estimated_casualties?: number;
  shelter_assignments?: Array<{ shelter_id: string; population: number }>;
  deployments?: Deployment[];
  triage_locations?: Array<{ lat: number; lng: number; priority: number }>;
  labels?: Label[];
  confidence: number;
  reasoning: string;
  summary?: string;
}

export interface AgentOutput {
  agent: 'path' | 'structural' | 'evacuation' | 'response';
  timestamp: number;
  type: 'update' | 'final';
  data: AgentData;
}

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export interface SimulationState {
  status: 'idle' | 'loading' | 'simulating' | 'complete' | 'error';
  townModel: TownModel | null;
  agentStatuses: Record<AgentOutput['agent'], AgentStatus>;
  agentOutputs: Record<AgentOutput['agent'], AgentOutput | null>;
  efScale: number;
  windDirection: string;
  address: string;
  error?: string;
}
