'use client';

import {
  Suspense,
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  TownModel,
  AgentOutput,
  DamageLevel,
  PathSegment,
  EvacuationRoute,
  Label,
} from '@/types';
import { latLngToLocal, distanceMeters } from '@/lib/geo';
import Buildings from './Buildings';
import TornadoVis from './TornadoVis';
import EvacRoutes from './EvacRoutes';
import Labels3D from './Labels3D';
import TimeSlider from './TimeSlider';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYBACK_DURATION = 20; // seconds to traverse full path

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Public props (unchanged) ─────────────────────────────────────────────────
interface Scene3DProps {
  townModel: TownModel;
  agentOutputs: Partial<Record<AgentOutput['agent'], AgentOutput>>;
}

// ─── SceneContent props ───────────────────────────────────────────────────────
interface SceneContentProps extends Scene3DProps {
  timeProgress: number;
  isPlaying: boolean;
  onProgressChange: (p: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

// ─── Pulsing waypoint for the "current" segment position ─────────────────────
function PulsingWaypoint({
  x,
  z,
  geom,
}: {
  x: number;
  z: number;
  geom: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.35;
    ref.current.scale.set(s, 1, s);
  });

  return (
    <mesh ref={ref} geometry={geom} position={[x, 0.5, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="white" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

// ─── Waypoint dots along the path ────────────────────────────────────────────
function WaypointDots({
  pathSegments,
  currentSegIdx,
  centerLat,
  centerLng,
}: {
  pathSegments: PathSegment[];
  currentSegIdx: number;
  centerLat: number;
  centerLng: number;
}) {
  const discGeom = useMemo(() => new THREE.CylinderGeometry(8, 8, 0.5, 16), []);

  const positions = useMemo(
    () =>
      pathSegments.map((seg) =>
        latLngToLocal(seg.lat, seg.lng, centerLat, centerLng),
      ),
    [pathSegments, centerLat, centerLng],
  );

  return (
    <>
      {positions.map(([x, z], i) => {
        if (i === currentSegIdx) {
          return <PulsingWaypoint key={i} x={x} z={z} geom={discGeom} />;
        }
        const ahead = i > currentSegIdx;
        return (
          <mesh
            key={i}
            geometry={discGeom}
            position={[x, 0.5, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={ahead ? '#2a3a50' : '#ef4444'}
              transparent
              opacity={ahead ? 0.3 : 0.6}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ─── SceneContent (runs inside Canvas) ───────────────────────────────────────
function SceneContent({
  townModel,
  agentOutputs,
  timeProgress,
  isPlaying,
  onProgressChange,
  onPlayingChange,
}: SceneContentProps) {
  const { lat: centerLat, lng: centerLng } = townModel.center;

  // Refs keep useFrame closure fresh between React renders
  const progressRef   = useRef(timeProgress);
  const isPlayingRef  = useRef(isPlaying);
  useEffect(() => { progressRef.current  = timeProgress; }, [timeProgress]);
  useEffect(() => { isPlayingRef.current = isPlaying;    }, [isPlaying]);

  // ── Derive agent data ──────────────────────────────────────────────────────
  const damageLevels = useMemo<Record<string, DamageLevel>>(() => {
    const structural = agentOutputs['structural'];
    if (!structural?.data.damage_levels) return {};
    return structural.data.damage_levels;
  }, [agentOutputs]);

  const pathSegments = useMemo<PathSegment[]>(() => {
    return agentOutputs['path']?.data.path_segments ?? [];
  }, [agentOutputs]);

  const evacuationRoutes = useMemo<EvacuationRoute[]>(() => {
    return agentOutputs['evacuation']?.data.evacuation_routes ?? [];
  }, [agentOutputs]);

  const blockedRoads = useMemo<string[]>(() => {
    return [
      ...(agentOutputs['structural']?.data.blocked_roads ?? []),
      ...(agentOutputs['evacuation']?.data.blocked_roads ?? []),
    ];
  }, [agentOutputs]);

  const allLabels = useMemo<Label[]>(() => {
    const labels: Label[] = [];
    for (const output of Object.values(agentOutputs)) {
      if (output?.data.labels) labels.push(...output.data.labels);
    }
    return labels;
  }, [agentOutputs]);

  // ── Auto-start when path data first arrives ────────────────────────────────
  const prevPathLen = useRef(0);
  useEffect(() => {
    if (pathSegments.length > 0 && prevPathLen.current === 0) {
      onPlayingChange(true);
    }
    prevPathLen.current = pathSegments.length;
  }, [pathSegments.length, onPlayingChange]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!isPlayingRef.current) return;
    const p = progressRef.current;
    if (p >= 1) return;
    const next = Math.min(p + delta / PLAYBACK_DURATION, 1);
    progressRef.current = next;
    onProgressChange(next);
    if (next >= 1) onPlayingChange(false);
  });

  // ── Interpolated tornado position ──────────────────────────────────────────
  const {
    currentLat,
    currentLng,
    currentWidth,
    currentWind,
    currentSegIdx,
  } = useMemo(() => {
    if (pathSegments.length === 0) {
      return { currentLat: 0, currentLng: 0, currentWidth: 100, currentWind: 0, currentSegIdx: 0 };
    }
    const segIdx = timeProgress * (pathSegments.length - 1);
    const i      = Math.floor(segIdx);
    const t      = segIdx - i;
    const segA   = pathSegments[i];
    const segB   = pathSegments[Math.min(i + 1, pathSegments.length - 1)];
    return {
      currentLat:   lerp(segA.lat,           segB.lat,           t),
      currentLng:   lerp(segA.lng,           segB.lng,           t),
      currentWidth: lerp(segA.width_m,       segB.width_m,       t),
      currentWind:  lerp(segA.wind_speed_mph, segB.wind_speed_mph, t),
      currentSegIdx: i,
    };
  }, [timeProgress, pathSegments]);

  // ── Damage reveal: only show damage for buildings the tornado has passed ───
  const filteredDamageLevels = useMemo<Record<string, DamageLevel>>(() => {
    if (pathSegments.length === 0) return damageLevels;
    const result: Record<string, DamageLevel> = {};
    for (const building of townModel.buildings) {
      const level = damageLevels[building.id];
      if (!level) continue;
      let hit = false;
      for (let si = 0; si <= currentSegIdx && si < pathSegments.length; si++) {
        const seg  = pathSegments[si];
        const dist = distanceMeters(
          seg.lat, seg.lng,
          building.centroid.lat, building.centroid.lng,
        );
        if (dist < seg.width_m / 2) {
          hit = true;
          break;
        }
      }
      result[building.id] = hit ? level : 'intact';
    }
    return result;
  }, [currentSegIdx, damageLevels, townModel.buildings, pathSegments]);

  // ── Path line geometry ─────────────────────────────────────────────────────
  const elapsedLine = useMemo(() => {
    if (pathSegments.length < 2) return null;
    const pts = pathSegments
      .slice(0, currentSegIdx + 2)
      .map((seg) => {
        const [x, z] = latLngToLocal(seg.lat, seg.lng, centerLat, centerLng);
        return new THREE.Vector3(x, 1, z);
      });
    if (pts.length < 2) return null;
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({ color: '#ef4444', linewidth: 2 });
    return new THREE.Line(geom, mat);
  }, [currentSegIdx, pathSegments, centerLat, centerLng]);

  const remainingLine = useMemo(() => {
    if (pathSegments.length < 2) return null;
    const pts = pathSegments
      .slice(Math.max(0, currentSegIdx))
      .map((seg) => {
        const [x, z] = latLngToLocal(seg.lat, seg.lng, centerLat, centerLng);
        return new THREE.Vector3(x, 1, z);
      });
    if (pts.length < 2) return null;
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({ color: '#2a3a50', linewidth: 1 });
    return new THREE.Line(geom, mat);
  }, [currentSegIdx, pathSegments, centerLat, centerLng]);

  return (
    <>
      {/* Atmosphere */}
      <fog attach="fog" args={['#0a0e17', 800, 3000]} />
      <color attach="background" args={['#0a0e17']} />

      {/* Lighting — stormy overcast */}
      <ambientLight intensity={0.25} color="#334466" />
      {/* Primary overcast fill */}
      <directionalLight
        position={[200, 600, 200]}
        intensity={0.8}
        color="#aabbcc"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Warm backlight */}
      <directionalLight position={[-300, 200, -300]} intensity={0.3} color="#ff6b2b" />
      {/* Pre-tornado sky — sickly yellow-green from directly above */}
      <directionalLight position={[0, 800, 0]} intensity={0.45} color="#b8d444" />

      {/* Stars overhead for atmosphere */}
      <Stars radius={2000} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />

      {/* Ground grid */}
      <Grid
        args={[2000, 2000]}
        cellSize={50}
        cellThickness={0.3}
        cellColor="#1e2a3a"
        sectionSize={200}
        sectionThickness={0.8}
        sectionColor="#2a3a50"
        fadeDistance={2000}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#0d1420" roughness={1} />
      </mesh>

      {/* Buildings with progressive damage reveal */}
      <Buildings
        buildings={townModel.buildings}
        damageLevels={filteredDamageLevels}
        centerLat={centerLat}
        centerLng={centerLng}
      />

      {/* Path lines: elapsed (red) + remaining (dim) */}
      {elapsedLine   && <primitive object={elapsedLine}   />}
      {remainingLine && <primitive object={remainingLine} />}

      {/* Waypoint dots at each segment position */}
      {pathSegments.length > 0 && (
        <WaypointDots
          pathSegments={pathSegments}
          currentSegIdx={currentSegIdx}
          centerLat={centerLat}
          centerLng={centerLng}
        />
      )}

      {/* Tornado funnel at interpolated position */}
      {pathSegments.length > 0 && (
        <TornadoVis
          lat={currentLat}
          lng={currentLng}
          width_m={currentWidth}
          wind_speed_mph={currentWind}
          centerLat={centerLat}
          centerLng={centerLng}
        />
      )}

      {/* Evacuation routes */}
      {(evacuationRoutes.length > 0 || blockedRoads.length > 0) && (
        <EvacRoutes
          roads={townModel.roads}
          evacuationRoutes={evacuationRoutes}
          blockedRoads={blockedRoads}
          infrastructure={townModel.infrastructure}
          centerLat={centerLat}
          centerLng={centerLng}
        />
      )}

      {/* Labels */}
      {allLabels.length > 0 && (
        <Labels3D labels={allLabels} centerLat={centerLat} centerLng={centerLng} />
      )}
    </>
  );
}

// ─── Scene3D — state owner, Canvas wrapper ────────────────────────────────────
export default function Scene3D({ townModel, agentOutputs }: Scene3DProps) {
  const [timeProgress, setTimeProgress] = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);

  const pathSegments = useMemo<PathSegment[]>(
    () => agentOutputs['path']?.data.path_segments ?? [],
    [agentOutputs],
  );

  const handleProgressChange = useCallback((p: number) => {
    setTimeProgress(p);
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(
    () => setIsPlaying((v) => !v),
    [],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0e17' }}>
      <Canvas
        shadows
        camera={{
          position: [0, 800, 600],
          fov: 45,
          near: 1,
          far: 8000,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
        }}
        style={{ height: pathSegments.length > 0 ? 'calc(100% - 72px)' : '100%' }}
      >
        <Suspense fallback={null}>
          <SceneContent
            townModel={townModel}
            agentOutputs={agentOutputs}
            timeProgress={timeProgress}
            isPlaying={isPlaying}
            onProgressChange={setTimeProgress}
            onPlayingChange={setIsPlaying}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          minDistance={100}
          maxDistance={3000}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
        />
      </Canvas>

      {pathSegments.length > 0 && (
        <TimeSlider
          timeProgress={timeProgress}
          isPlaying={isPlaying}
          pathSegments={pathSegments}
          playbackDuration={PLAYBACK_DURATION}
          onProgressChange={handleProgressChange}
          onPlayPause={handlePlayPause}
        />
      )}
    </div>
  );
}
