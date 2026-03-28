'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToLocal } from '@/lib/geo';

// Props: single interpolated position (computed by SceneContent animation loop)
export interface TornadoVisProps {
  lat: number;
  lng: number;
  width_m: number;
  wind_speed_mph: number;
  centerLat: number;
  centerLng: number;
}

// ─── Ground shadow: pulsing circle under the funnel ──────────────────────────
function GroundShadow({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = 0.9 + Math.sin(t * 3.1) * 0.1;
    ref.current.scale.set(pulse, 1, pulse);
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.28 + Math.abs(Math.sin(t * 2.3)) * 0.14;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <circleGeometry args={[radius * 1.3, 64]} />
      <meshBasicMaterial
        color="#000000"
        transparent
        opacity={0.32}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Dust ring: expanding flat ring of debris at ground contact ──────────────
function DustRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = 0.92 + Math.sin(t * 2.7) * 0.08;
    ref.current.scale.set(pulse, 1, pulse);
    (ref.current.material as THREE.MeshStandardMaterial).opacity =
      0.12 + Math.abs(Math.sin(t * 1.9)) * 0.22;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
      <ringGeometry args={[radius * 0.7, radius * 1.7, 64]} />
      <meshStandardMaterial
        color="#3d1c06"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Debris ring: instanced boxes orbiting the funnel base ───────────────────
const DEBRIS_COUNT = 80;

function DebrisRing({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const angles = new Float32Array(DEBRIS_COUNT);
    const radii  = new Float32Array(DEBRIS_COUNT);
    const speeds = new Float32Array(DEBRIS_COUNT);
    const scales = new Float32Array(DEBRIS_COUNT);
    const yBase  = new Float32Array(DEBRIS_COUNT);

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      angles[i] = (i / DEBRIS_COUNT) * Math.PI * 2;
      radii[i]  = radius * (0.45 + Math.random() * 0.85);
      speeds[i] = 1.1 + Math.random() * 0.8;
      scales[i] = 0.5 + Math.random() * 2.0;
      yBase[i]  = Math.random() * 28;
    }
    return { angles, radii, speeds, scales, yBase };
  }, [radius]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const angle = data.angles[i] - t * 1.5 * data.speeds[i];
      dummy.position.set(
        Math.cos(angle) * data.radii[i],
        data.yBase[i],
        Math.sin(angle) * data.radii[i],
      );
      const s = data.scales[i];
      dummy.scale.set(s, s, s);
      dummy.rotation.set(t * data.speeds[i] * 1.3, t * data.speeds[i], 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]}>
      <boxGeometry args={[3, 3, 3]} />
      <meshStandardMaterial color="#1a0c04" roughness={0.95} />
    </instancedMesh>
  );
}

// ─── Single funnel layer (CylinderGeometry, open-ended) ──────────────────────
interface FunnelLayerProps {
  topRadius: number;
  bottomRadius: number;
  height: number;
  yOffset?: number;
  color: string;
  opacity: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** rad/s — negative = counterclockwise from above */
  rotSpeed: number;
}

function FunnelLayer({
  topRadius,
  bottomRadius,
  height,
  yOffset = 0,
  color,
  opacity,
  emissive,
  emissiveIntensity = 0,
  rotSpeed,
}: FunnelLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geom = useMemo(
    () => new THREE.CylinderGeometry(topRadius, bottomRadius, height, 32, 8, true),
    [topRadius, bottomRadius, height],
  );

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * rotSpeed;
  });

  return (
    <mesh ref={meshRef} geometry={geom} position={[0, height / 2 + yOffset, 0]}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        emissive={emissive ?? color}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

// ─── Full tornado funnel assembly ─────────────────────────────────────────────
function TornadoFunnel({
  position,
  width_m,
}: {
  position: [number, number, number];
  width_m: number;
}) {
  const groupRef   = useRef<THREE.Group>(null);
  const flickerRef = useRef<THREE.PointLight>(null);

  const radius = Math.min(width_m * 0.5, 200);
  const H = 600;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Horizontal wobble — sine on X, cosine on Z
    if (groupRef.current) {
      groupRef.current.position.set(
        position[0] + Math.sin(t * 0.42) * 14,
        position[1],
        position[2] + Math.cos(t * 0.31) * 9,
      );
    }

    // Flickering internal glow
    if (flickerRef.current) {
      flickerRef.current.intensity = 0.25 + Math.random() * 0.45;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <GroundShadow radius={radius} />
      <DustRing     radius={radius} />
      <DebrisRing   radius={radius} />

      {/* Layer 1 — outer shell, dark & semi-opaque, slowest */}
      <FunnelLayer
        topRadius={radius}
        bottomRadius={radius * 0.055}
        height={H}
        color="#200d08"
        opacity={0.70}
        rotSpeed={-0.3}
      />

      {/* Layer 2 — mid shell */}
      <FunnelLayer
        topRadius={radius * 0.73}
        bottomRadius={radius * 0.038}
        height={H * 0.95}
        color="#2e1208"
        opacity={0.52}
        rotSpeed={-0.52}
      />

      {/* Layer 3 — inner shell, blue-grey tint */}
      <FunnelLayer
        topRadius={radius * 0.46}
        bottomRadius={radius * 0.022}
        height={H * 0.88}
        color="#0f1628"
        opacity={0.42}
        rotSpeed={-0.78}
      />

      {/* Layer 4 — core glow, cyan emissive */}
      <FunnelLayer
        topRadius={radius * 0.22}
        bottomRadius={radius * 0.01}
        height={H * 0.78}
        color="#a8d8f0"
        opacity={0.20}
        emissive="#22d3ee"
        emissiveIntensity={1.4}
        rotSpeed={-0.9}
      />

      {/* Internal flickering point light */}
      <pointLight
        ref={flickerRef}
        position={[0, H * 0.32, 0]}
        color="#b0dfff"
        intensity={0.38}
        distance={radius * 2.8}
        decay={2}
      />
    </group>
  );
}

// ─── Public component — renders funnel at a single interpolated position ─────
export default function TornadoVis({
  lat,
  lng,
  width_m,
  centerLat,
  centerLng,
}: TornadoVisProps) {
  const [x, z] = latLngToLocal(lat, lng, centerLat, centerLng);
  const funnelPos: [number, number, number] = [x, 0, z];

  return (
    <group name="tornado">
      <TornadoFunnel position={funnelPos} width_m={width_m} />
    </group>
  );
}
