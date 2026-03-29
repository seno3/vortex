import { GoogleGenerativeAI } from '@google/generative-ai';
import { TownModel, AgentOutput, AgentData, PathSegment } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const MODEL = 'gemini-2.5-flash-preview-04-17';

/** Parse the retry-after delay (seconds) out of a Gemini 429 error message. */
function parseRetryDelay(err: unknown): number {
  const msg = String(err);
  const match = msg.match(/retry[^\d]*(\d+(?:\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : 5;
}

async function callAgent(prompt: string, retries = 3): Promise<AgentData> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    } as Parameters<typeof genAI.getGenerativeModel>[0]['generationConfig'],
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text()) as AgentData;
    } catch (err) {
      if (attempt === retries) throw err;
      const is429 = String(err).includes('429');
      const delay = is429 ? parseRetryDelay(err) * 1000 : 1000 * (attempt + 1);
      console.warn(`Agent attempt ${attempt + 1} failed (${is429 ? '429 rate-limit' : 'error'}), retrying in ${delay / 1000}s…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Agent failed after retries');
}

const EF_WIND_SPEEDS: Record<number, { min: number; max: number; width_m: number }> = {
  1: { min: 86,  max: 110, width_m: 150  },
  2: { min: 111, max: 135, width_m: 300  },
  3: { min: 136, max: 165, width_m: 500  },
  4: { min: 166, max: 200, width_m: 800  },
  5: { min: 201, max: 250, width_m: 1200 },
};

// EF Scale Damage Indicator (DI) reference — embedded in agent prompts
const EF_DI_REFERENCE = `
EF Scale Damage Indicator Reference (TORRO/NWS standard):
- DI 1: One/Two Family Residences (wood frame) — destroyed at EF3+ within path width
- DI 2: Manufactured homes / mobile homes — destroyed at EF1+ winds
- DI 3: Apartments/condos (light construction) — major damage EF2+, destroyed EF3+
- DI 4: Masonry commercial (strip malls, retail) — major damage EF3+, destroyed EF4+
- DI 5: Large strip mall / big-box retail — major damage EF3+, destroyed EF4+
- DI 6: Schools (brick construction) — significant structural damage EF3+, destroyed EF4+
- DI 7: Hospitals (reinforced concrete) — major damage EF4+, destroyed EF5
- DI 8: Industrial/warehouse (steel frame) — major damage EF4+, destroyed EF5
- DI 9: Churches and places of worship — major damage EF3+
Wind speed tiers: EF1=86-110mph, EF2=111-135mph, EF3=136-165mph, EF4=166-200mph, EF5=200+mph
`;

const LABEL_SCHEMA = `
Each label must follow this exact schema:
{
  "id": "unique_string",
  "position": { "lat": number, "lng": number },
  "text": "SHORT TITLE IN CAPS (max 40 chars)",
  "severity": "critical" | "warning" | "evacuation" | "deployment",
  "details": "One supporting sentence with specific data (wind speed, material, etc.)"
}
Severity guide: critical=life safety/structural failure, warning=significant damage/caution, evacuation=route/shelter info, deployment=response resource staging
`;

function buildPathPrompt(townModel: TownModel, efScale: number, windDirection: string): string {
  const ef = EF_WIND_SPEEDS[efScale];
  return `You are a meteorological AI simulating an EF${efScale} tornado path for emergency planning.

${EF_DI_REFERENCE}

TASK: Generate a realistic EF${efScale} tornado path through this area.

EF${efScale} SPECS: Wind speed ${ef.min}–${ef.max} mph · Typical path width ${ef.width_m}m · General movement: ${windDirection}

TOWN CENTER: ${townModel.center.lat.toFixed(5)}, ${townModel.center.lng.toFixed(5)}
BOUNDS: N=${townModel.bounds.north.toFixed(5)} S=${townModel.bounds.south.toFixed(5)} E=${townModel.bounds.east.toFixed(5)} W=${townModel.bounds.west.toFixed(5)}
BUILDINGS: ${townModel.buildings.length}

PATH RULES:
- Enter from one edge, exit another (enter from the wind direction side)
- 8–12 path points tracing a slightly curved, realistic track
- Width and wind speed vary: peak in middle section, taper at entry/exit
- Include 2–3 debris zones centered on peak intensity

LABEL RULES (generate exactly 5 labels along the path):
${LABEL_SCHEMA}
Label types to include: path entry point, peak intensity zone, debris field boundary, vortex touchdown, path exit

RETURN EXACTLY this JSON (no extra fields, no markdown):
{
  "path_segments": [{ "lat": number, "lng": number, "width_m": number, "wind_speed_mph": number }],
  "debris_zones": [{ "lat": number, "lng": number, "radius_m": number }],
  "labels": [...],
  "confidence": number,
  "reasoning": string,
  "summary": string
}`;
}

function buildStructuralPrompt(
  townModel: TownModel,
  efScale: number,
  pathData: AgentData
): string {
  const buildingList = townModel.buildings.slice(0, 60).map((b) => ({
    id: b.id,
    lat: b.centroid.lat,
    lng: b.centroid.lng,
    type: b.type,
    material: b.material,
    levels: b.levels,
    area_sqm: b.area_sqm,
  }));

  return `You are a structural engineering AI assessing EF${efScale} tornado damage.

${EF_DI_REFERENCE}

TORNADO PATH: ${JSON.stringify(pathData.path_segments)}
DEBRIS ZONES: ${JSON.stringify(pathData.debris_zones)}

BUILDINGS (${buildingList.length}):
${JSON.stringify(buildingList)}

ROADS: ${JSON.stringify(townModel.roads.map((r) => ({ id: r.id, name: r.name, type: r.type })))}

ASSESSMENT RULES:
- Buildings within path width: high destruction probability per material/DI type
- Within 1.5x path width: major damage likely
- Within 2x path width: minor damage possible
- Material resistance (weakest→strongest): wood < brick < concrete < steel
- Use EF Scale DI reference above for each building type
- Show DI reasoning in label details: "DI 2 wood-frame, EF4 winds → destroyed"

LABEL RULES (generate exactly 6 labels at the most significant structures):
${LABEL_SCHEMA}
Include: worst-hit residential block, any destroyed school/hospital, commercial district damage, intact structure for contrast

RETURN EXACTLY this JSON:
{
  "damage_levels": { "building_id": "destroyed"|"major"|"minor"|"intact" },
  "affected_buildings": ["building_id"],
  "blocked_roads": ["road_id"],
  "estimated_casualties": number,
  "labels": [...],
  "confidence": number,
  "reasoning": string,
  "summary": string
}`;
}

function buildEvacuationPrompt(
  townModel: TownModel,
  pathData: AgentData,
  structuralData: AgentData
): string {
  const destroyedCount = Object.values(structuralData.damage_levels ?? {}).filter(
    (v) => v === 'destroyed'
  ).length;

  return `You are an emergency management AI planning evacuation after an EF tornado strike.

SITUATION: ${destroyedCount} buildings destroyed, ${structuralData.estimated_casualties} estimated casualties
BLOCKED ROADS: ${JSON.stringify(structuralData.blocked_roads)}
TORNADO PATH MIDPOINT: lat=${pathData.path_segments?.[Math.floor((pathData.path_segments?.length ?? 0) / 2)]?.lat}, lng=${pathData.path_segments?.[Math.floor((pathData.path_segments?.length ?? 0) / 2)]?.lng}

ALL ROADS: ${JSON.stringify(townModel.roads.map((r) => ({ id: r.id, name: r.name, type: r.type, geometry: r.geometry.slice(0, 3) })))}
INFRASTRUCTURE: ${JSON.stringify(townModel.infrastructure)}

ROUTING RULES:
- Route away from damage zone (perpendicular to tornado track)
- Avoid blocked roads
- Prefer primary/secondary over residential
- Identify shelters for displaced survivors

LABEL RULES (generate exactly 5 labels):
${LABEL_SCHEMA}
Include: primary evac route, shelter location, hospital access route, blocked road warning, rescue staging area

RETURN EXACTLY this JSON:
{
  "evacuation_routes": [{ "road_ids": ["id"], "priority": number, "geometry": [[lat, lng]] }],
  "blocked_roads": ["road_id"],
  "shelter_assignments": [{ "shelter_id": "id", "population": number }],
  "estimated_casualties": number,
  "labels": [...],
  "confidence": number,
  "reasoning": string,
  "summary": string
}`;
}

function buildResponsePrompt(
  townModel: TownModel,
  efScale: number,
  pathData: AgentData,
  structuralData: AgentData,
  evacuationData: AgentData
): string {
  const destroyedCount = Object.values(structuralData.damage_levels ?? {}).filter(
    (v) => v === 'destroyed'
  ).length;
  const majorCount = Object.values(structuralData.damage_levels ?? {}).filter(
    (v) => v === 'major'
  ).length;

  return `You are an emergency response coordination AI creating the final deployment plan.

SITUATION SUMMARY:
- EF${efScale} strike on ${townModel.population_estimate.toLocaleString()} person community
- Destroyed: ${destroyedCount} buildings · Major damage: ${majorCount} buildings
- Casualties: ~${evacuationData.estimated_casualties}
- Blocked roads: ${evacuationData.blocked_roads?.length ?? 0}
- Active evac routes: ${evacuationData.evacuation_routes?.length ?? 0}

INFRASTRUCTURE: ${JSON.stringify(townModel.infrastructure)}
TORNADO PATH PEAK: ${JSON.stringify(pathData.path_segments?.[Math.floor((pathData.path_segments?.length ?? 0) / 2)])}

DEPLOYMENT RULES:
- Stage ambulances within 500m of heaviest damage, on clear roads
- Triage at undamaged schools/community centers
- Search priority: destroyed wood-frame residential with high occupancy
- Command post: accessible central location outside damage zone
- Fire crews near collapsed structures

LABEL RULES (generate exactly 5 labels):
${LABEL_SCHEMA}
Include: command post location, primary triage site, search priority zone, ambulance staging, do-not-enter perimeter

RETURN EXACTLY this JSON:
{
  "deployments": [{ "type": string, "location": { "lat": number, "lng": number }, "reason": string }],
  "triage_locations": [{ "lat": number, "lng": number, "priority": number }],
  "labels": [...],
  "confidence": number,
  "reasoning": string,
  "summary": string
}`;
}

export async function runAgents(
  townModel: TownModel,
  efScale: number,
  windDirection: string,
  onUpdate: (output: AgentOutput) => void
): Promise<void> {
  const now = () => Date.now();

  // Agent 1: Path
  onUpdate({ agent: 'path', timestamp: now(), type: 'update', data: { confidence: 0, reasoning: 'Analyzing meteorological data and computing path trajectory...' } });
  const pathData = await callAgent(buildPathPrompt(townModel, efScale, windDirection));
  onUpdate({ agent: 'path', timestamp: now(), type: 'final', data: pathData });

  // Agent 2: Structural
  onUpdate({ agent: 'structural', timestamp: now(), type: 'update', data: { confidence: 0, reasoning: 'Applying EF Scale Damage Indicators to each structure...' } });
  const structuralData = await callAgent(buildStructuralPrompt(townModel, efScale, pathData));
  onUpdate({ agent: 'structural', timestamp: now(), type: 'final', data: structuralData });

  // Agent 3: Evacuation
  onUpdate({ agent: 'evacuation', timestamp: now(), type: 'update', data: { confidence: 0, reasoning: 'Computing evacuation routes around damage zone...' } });
  const evacuationData = await callAgent(buildEvacuationPrompt(townModel, pathData, structuralData));
  onUpdate({ agent: 'evacuation', timestamp: now(), type: 'final', data: evacuationData });

  // Agent 4: Response
  onUpdate({ agent: 'response', timestamp: now(), type: 'update', data: { confidence: 0, reasoning: 'Synthesizing all agent data into deployment plan...' } });
  const responseData = await callAgent(buildResponsePrompt(townModel, efScale, pathData, structuralData, evacuationData));
  onUpdate({ agent: 'response', timestamp: now(), type: 'final', data: responseData });
}
