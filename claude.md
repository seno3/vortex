# VORTEX — Claude Reference Document

## What This Is
Vortex is an AI tornado impact simulator. User types an address, picks an EF scale, and watches a multi-agent AI system simulate tornado damage on a photorealistic 3D Gaussian splat world model of the real location — with actionable labels (not color-coded buildings) streaming in real time from AI agents.

## Why It Exists
- US averages ~1,200 tornadoes/year, ~$5B+ annual damage
- FEMA's Hazus covers floods, hurricanes, earthquakes — but has NO tornado model
- The only existing tornado damage model (CIMSS for DHS) uses 1950s vortex equations on a GIS desktop app
- Emergency managers have no tool to simulate "what if an EF4 hits THIS town" with real building data
- Built for the "Best Use of Vultr" hackathon prize

## Architecture Overview

```
[Address Input] → [Google Street View imagery] → [AI Image Enhancement (tornado damage)]
                                                          ↓
                                                  [World Labs Marble API]
                                                          ↓
                                                  [3D Gaussian Splat (.spz)]
                                                          ↓
[OSM Data Pipeline] → [Town Model JSON] → [Agent Orchestrator]
                                            ┌───────┴────────┐
                                    [Agent 1: Path]  [Agent 2: Structural]
                                    [Agent 3: Evac]  [Agent 4: Response]
                                            └───────┬────────┘
                                          [Redis State Sharing]
                                                    ↓
                                    [WebSocket Stream to Frontend]
                                            ↓              ↓
                              [Spark 3DGS Renderer     [Dashboard Panels]
                               + Drei Html Labels]
```

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React Three Fiber, Drei, Spark (3DGS renderer), Mapbox GL JS, Tailwind CSS
- **3D World Model**: World Labs Marble API → Gaussian Splat → Spark renderer for Three.js
- **Real-time**: WebSockets (Socket.IO)
- **Backend**: Next.js API routes + standalone WebSocket server
- **AI Agents**: Google Gemini API (gemini-2.5-flash) via @google/generative-ai SDK
- **Image Enhancement**: Gemini vision or image generation API (tornado damage overlay on Street View photos)
- **State**: Redis for inter-agent communication
- **Data Sources**: OpenStreetMap Overpass API (buildings/roads), Mapbox (geocoding), Google Street View (imagery)

## World Model Pipeline (THE KEY DIFFERENTIATOR)

This is the Orca-inspired photorealistic pipeline. It produces a navigable 3D Gaussian splat of the real location showing tornado damage.

### Step 1: Get Street View Imagery
- Use Google Street View Static API to pull exterior images of the target area
- For MVP/demo: pre-download 2-4 images of the demo location (Moore, Oklahoma)
- Images should cover different angles of the target street/buildings

### Step 2: AI Image Enhancement
- Take clean Street View photos and generate tornado-damaged versions
- Use Gemini's image understanding + an image generation API to create consistent damaged imagery:
  - Debris on ground, damaged roofs, broken windows, leaning structures, overturned vehicles
  - Each generated image must be contextually aware of previous outputs for consistency
- Chain generation: enhance image 1, use it as context for image 2, etc.
- For MVP: pre-generate 2-4 enhanced images before the demo

### Step 3: World Labs Marble API → Gaussian Splat
- Feed enhanced (tornado-damaged) panorama/images into World Labs API
- API endpoint: REST API, async generation
- Returns a downloadable .spz (compressed Gaussian splat) file
- Free tier: 4 generations/month. Standard ($20/mo): 12 generations + API access
- Generation takes minutes, NOT seconds — pre-generate demo scenes
- For MVP: pre-generate 1-3 world models for demo locations and store as static .spz files

### Step 4: Render with Spark in Three.js
- Spark is World Labs' open-source MIT-licensed Three.js Gaussian splat renderer
- Install: `npm install @sparkjsdev/spark`
- Usage with React Three Fiber:
```typescript
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

function GaussianSplatScene({ splatUrl }: { splatUrl: string }) {
  const { scene, gl } = useThree();

  useEffect(() => {
    const spark = new SparkRenderer({ renderer: gl });
    scene.add(spark);
    const splat = new SplatMesh({ url: splatUrl });
    scene.add(splat);
    return () => { scene.remove(spark); scene.remove(splat); };
  }, [splatUrl, scene, gl]);

  return null;
}
```

### Step 5: Overlay Labels (NOT color-coded buildings)
- All damage information is communicated via floating labels in 3D space
- Use Drei's `<Html>` component positioned at coordinates within the splat
- Labels are the ONLY damage visualization — the world model shows the photorealistic scene
- Label severity types:
  - CRITICAL (red border): "STRUCTURAL FAILURE — DO NOT ENTER"
  - WARNING (orange border): "PARTIAL DAMAGE — USE CAUTION"
  - EVACUATION (green border): "EVACUATION ROUTE → EAST"
  - DEPLOYMENT (blue border): "TRIAGE STAGING AREA"

## Data Pipeline Detail

### Address → Town Model
1. Geocode address via Mapbox Geocoding API
2. Query OSM Overpass for building footprints in ~500m radius
3. Extract: building polygons, tags (material, levels, type), centroid coords
4. Query critical infrastructure: hospitals, schools, fire stations, shelters
5. Get road network for evacuation routing
6. Package into TownModel JSON schema

### TownModel Schema
```typescript
interface TownModel {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  buildings: Array<{
    id: string;
    centroid: { lat: number; lng: number };
    polygon: [number, number][];
    type: string;
    levels: number;
    material: string;
    area_sqm: number;
  }>;
  roads: Array<{
    id: string;
    name: string;
    geometry: [number, number][];
    type: string;
  }>;
  infrastructure: Array<{
    id: string;
    type: string;
    name: string;
    position: { lat: number; lng: number };
    capacity?: number;
  }>;
  population_estimate: number;
}
```

## Agent System Detail

All agents receive the TownModel + simulation params (EF scale, direction).
Agents communicate via Redis pub/sub. Each agent MUST return labels with 3D positions.

### EF Scale Damage Reference (EMBED IN AGENT PROMPTS)
- 28 Damage Indicators (DIs): building types like single-family homes, mobile homes, strip malls
- 8 Degrees of Damage (DoD) per DI: from first visible damage to total destruction
- Key relationships:
  - Wood-frame residential (DI 2): destroyed at EF3+ within 1.5x path width
  - Mobile homes (DI 1): destroyed at EF1+
  - Masonry commercial (DI 5): major damage at EF3+, destroyed at EF4+
  - Steel/concrete (DI 13): major damage at EF4+, destroyed at EF5
  - Schools (DI 19): significant structural damage at EF3+

### Agent 1: Tornado Path & Physics
- Output: Path segments with wind speeds, width, debris generation rate
- Output MUST include labels: path markers, wind speed zones, debris field boundaries

### Agent 2: Structural Impact
- Output: Per-building damage assessment with confidence
- Output MUST include labels: damage ratings with EF Scale DI/DoD reasoning shown
- EVERY label shows: building type → DI → wind speed → DoD → rating

### Agent 3: Evacuation & Human Safety
- Output: Evacuation routes, blocked roads, trapped population estimates
- Output MUST include labels: route markers, blocked road warnings, shelter directions

### Agent 4: Emergency Response
- Output: Resource deployment plan
- Output MUST include labels: staging positions, triage points, hospital routing

### Agent Output Schema
```typescript
interface AgentOutput {
  agent: 'path' | 'structural' | 'evacuation' | 'response';
  timestamp: number;
  type: 'update' | 'final';
  data: {
    affected_buildings?: string[];
    damage_levels?: Record<string, 'destroyed' | 'major' | 'minor' | 'intact'>;
    path_segments?: Array<{ lat: number; lng: number; width: number; wind_speed: number }>;
    evacuation_routes?: Array<{ road_ids: string[]; priority: number }>;
    blocked_roads?: string[];
    deployments?: Array<{ type: string; location: { lat: number; lng: number }; reason: string }>;
    confidence: number;
    reasoning: string;
  };
  labels: Array<{
    id: string;
    position: { lat: number; lng: number };
    elevation_m: number;
    text: string;
    severity: 'critical' | 'warning' | 'evacuation' | 'deployment';
    details?: string;
  }>;
}
```

## 3D Scene Specification

### CRITICAL: Gaussian Splat + Labels Only
- The 3D scene is a Gaussian splat rendered via Spark — NOT extruded building boxes
- There are NO color-coded buildings. Damage is communicated ONLY through labels
- The splat provides the photorealistic wow factor
- The labels provide the actionable intelligence

### Labels (Primary Information Layer)
- Drei `<Html>` components positioned in 3D space within the splat
- Dark card style with colored left border matching severity
- Labels fade in with CSS animation as agents stream them
- Click/hover expands to show detailed reasoning
- Feel like augmented reality HUD overlays on the photorealistic scene

### Camera
- Default: immersive view within the splat (standing on the street)
- OrbitControls for flying around the scene
- Smooth camera animation on simulation start

## Dashboard Panels
1. **Simulation Controls**: Address input, EF scale selector, direction picker, "Simulate" button
2. **Agent Status**: Live indicators per agent with confidence scores
3. **Impact Summary**: Buildings destroyed/damaged, estimated casualties, roads blocked
4. **Response Plan**: Resource deployment from Agent 4
5. **Reasoning Chain**: EF Scale DI/DoD methodology display (credibility proof)
6. **Cost Ticker**: Live Vultr compute cost display

## Vultr Integration Points
- App deployment: Vultr Kubernetes Engine or Vultr Cloud Compute
- Redis: Vultr Cloud Compute instance
- Pre-generated splat files: Vultr Object Storage (serve via CDN)
- Cached simulation results: Vultr Object Storage
- Cost story: flat $0.01/GB egress for heavy splat files, free K8s control plane

## AI Provider
- Google Gemini API via `@google/generative-ai` npm package
- Model: `gemini-2.5-flash`
- Environment variable: `GEMINI_API_KEY`
- `responseMimeType: "application/json"` for structured output

## File Structure
```
vortex/
├── package.json
├── next.config.js
├── .env.local
├── .env.example
├── .gitignore
├── claude.md
├── public/
│   └── splats/                  # Pre-generated Gaussian splat files
│       ├── moore-ok-ef4.spz     # Demo: Moore, Oklahoma EF4 scenario
│       └── demo-fallback.spz    # Fallback
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── simulate/route.ts
│   │       ├── geocode/route.ts
│   │       └── buildings/route.ts
│   ├── components/
│   │   ├── Map.tsx
│   │   ├── SplatScene.tsx       # Spark Gaussian splat renderer
│   │   ├── Labels3D.tsx         # Drei Html labels in splat scene
│   │   ├── Dashboard.tsx
│   │   ├── AgentStatus.tsx
│   │   ├── ReasoningChain.tsx
│   │   ├── SimControls.tsx
│   │   └── CostTicker.tsx
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── orchestrator.ts
│   │   │   ├── pathAgent.ts
│   │   │   ├── structuralAgent.ts
│   │   │   ├── evacuationAgent.ts
│   │   │   └── responseAgent.ts
│   │   ├── data/
│   │   │   ├── osm.ts
│   │   │   ├── geocode.ts
│   │   │   └── townModel.ts
│   │   ├── worldmodel/
│   │   │   ├── streetview.ts
│   │   │   ├── enhance.ts
│   │   │   └── worldlabs.ts
│   │   ├── geo.ts
│   │   ├── redis.ts
│   │   └── socket.ts
│   └── types/
│       └── index.ts
└── server/
    └── ws.ts
```

## Design Direction
- **Aesthetic**: Dark, tactical, utilitarian — emergency operations center
- **Primary bg**: Near-black (`#0a0a0f`)
- **Accent**: Warning orange (`#ff6b2b`) and alert red (`#ef4444`)
- **Secondary accent**: Cool cyan (`#22d3ee`) for safe zones and data
- **Typography**: Monospace for data (JetBrains Mono), sans-serif for UI (Geist)
- **Labels**: AR-style HUD overlays on the photorealistic scene

## Key Constraints
1. No hardware/IoT — pure software
2. World model generation is PRE-COMPUTED — not real-time during demo
3. Agent orchestration + label streaming IS real-time during demo
4. Labels are the ONLY damage visualization — no color-coded buildings
5. 3D Gaussian splat scene is the hero — first thing judges see
6. Desktop only — no mobile needed
7. Include pre-generated splat files for Moore, Oklahoma
8. Fall back gracefully if splat file is missing

## Demo Flow
1. Open dashboard → dark map with address search
2. Type "Moore, Oklahoma" → building data loads from OSM
3. Select EF4, wind direction SW→NE, click "Simulate"
4. Scene transitions to photorealistic Gaussian splat of Moore post-tornado
5. Agent 1: tornado path labels stream in ("EF4 PATH — 166+ MPH WINDS")
6. Agent 2: structural labels stream in ("WOOD FRAME DESTROYED — DI2/DoD7")
7. Agent 3: evacuation labels stream in ("ROUTE BLOCKED", "EVACUATE EAST")
8. Agent 4: deployment labels stream in ("STAGE AMBULANCES HERE", "TRIAGE POINT")
9. Dashboard fills with summary, reasoning chains, cost ticker
10. Judges fly through photorealistic destruction reading labels