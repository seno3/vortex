'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { SceneLabel, TownModel } from '@/types';
import Labels3D from './Labels3D';

// How much to scale the splat mesh — World Labs scenes tend to render small.
const SPLAT_SCALE = 3;

// ─── Splat world ──────────────────────────────────────────────────────────────
function SplatWorld({
  splatUrl,
  onLoaded,
  onError,
}: {
  splatUrl: string;
  onLoaded: () => void;
  onError: () => void;
}) {
  const { scene, gl } = useThree();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let spark: any = null;
    let splat: THREE.Object3D | null = null;
    let cancelled = false;

    import('@sparkjsdev/spark').then(({ SparkRenderer, SplatMesh }) => {
      if (cancelled) return;
      try {
        spark = new SparkRenderer({ renderer: gl });
        scene.add(spark as unknown as THREE.Object3D);

        const splatMesh = new SplatMesh({
          url: splatUrl,
          onLoad: () => { if (!cancelled) onLoaded(); },
        });
        splatMesh.initialized.catch((err: unknown) => {
          console.error('[SplatWorld] load failed:', err);
          if (!cancelled) onError();
        });
        splat = splatMesh as unknown as THREE.Object3D;
        splat.scale.setScalar(SPLAT_SCALE);
        scene.add(splat);
      } catch (err) {
        console.error('[SplatWorld] setup error:', err);
        if (!cancelled) onError();
      }
    }).catch((err: unknown) => {
      console.error('[SplatWorld] spark import failed:', err);
      if (!cancelled) onError();
    });

    return () => {
      cancelled = true;
      if (splat) scene.remove(splat);
      if (spark) scene.remove(spark as unknown as THREE.Object3D);
    };
  }, [splatUrl, scene, gl, onLoaded, onError]);

  return null;
}

// ─── Fallback scene ───────────────────────────────────────────────────────────
function FallbackScene() {
  return (
    <>
      <fog attach="fog" args={['#0a0e17', 30, 120]} />
      <color attach="background" args={['#0a0e17']} />
      <ambientLight intensity={0.2} color="#334466" />
      <directionalLight position={[10, 30, 10]} intensity={0.6} color="#aabbcc" />
      <directionalLight position={[-10, 10, -10]} intensity={0.2} color="#ff6b2b" />
      <Stars radius={200} depth={40} count={800} factor={2} saturation={0} fade speed={0.3} />
      <Grid
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.3}
        cellColor="#1e2a3a"
        sectionSize={20}
        sectionThickness={0.6}
        sectionColor="#2a3a50"
        fadeDistance={120}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#0d1420" roughness={1} />
      </mesh>
    </>
  );
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,20,0.7)',
      backdropFilter: 'blur(4px)', zIndex: 10, fontFamily: 'ui-monospace, monospace',
      gap: '12px', pointerEvents: 'none',
    }}>
      <div style={{
        width: '28px', height: '28px', border: '2px solid #1e2a3a',
        borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '11px', color: '#556677', letterSpacing: '0.1em' }}>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export interface WorldGenProgress {
  stage: string;
  detail: string;
}

interface SplatSceneProps {
  splatUrl: string | null;
  labels: SceneLabel[];
  townModel: TownModel | null;
  worldGenProgress?: WorldGenProgress | null;
}

export default function SplatScene({ splatUrl, labels, townModel, worldGenProgress }: SplatSceneProps) {
  const [splatLoaded, setSplatLoaded] = useState(false);
  const [splatFailed, setSplatFailed] = useState(!splatUrl);

  const handleLoaded = useCallback(() => setSplatLoaded(true), []);
  const handleError  = useCallback(() => setSplatFailed(true), []);

  useEffect(() => {
    setSplatFailed(!splatUrl);
    setSplatLoaded(false);
  }, [splatUrl]);

  const showFallback = splatFailed || !splatUrl;
  const showLoading  = !!splatUrl && !splatLoaded && !splatFailed;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0f' }}>
      <Canvas
        camera={{ position: [0, 8, 20], fov: 60, near: 0.05, far: 2000 }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <Suspense fallback={null}>
          {showFallback ? <FallbackScene /> : (
            <>
              <ambientLight intensity={0.3} />
              <SplatWorld splatUrl={splatUrl!} onLoaded={handleLoaded} onError={handleError} />
            </>
          )}
          <Labels3D labels={labels} />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={500}
          makeDefault
        />
      </Canvas>

      {/* Loading overlay */}
      {showLoading && <LoadingOverlay message="LOADING WORLD MODEL..." />}

      {/* World gen progress overlay */}
      {worldGenProgress && worldGenProgress.stage !== 'complete' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(8,12,20,0.82)',
          backdropFilter: 'blur(6px)', zIndex: 15, fontFamily: 'ui-monospace, monospace',
          gap: '16px', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '10px', color: '#ef4444', letterSpacing: '0.2em', marginBottom: '4px' }}>
            GENERATING WORLD MODEL
          </div>
          <div style={{
            width: '32px', height: '32px', border: '2px solid #1e2a3a',
            borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ textAlign: 'center', maxWidth: '280px', gap: '6px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '11px', color: '#8899aa', letterSpacing: '0.05em' }}>
              {worldGenProgress.stage === 'streetview'
                ? 'FETCHING STREET VIEW IMAGERY'
                : worldGenProgress.stage === 'worldgen'
                ? 'PROCESSING 3D RECONSTRUCTION'
                : 'BUILDING WORLD MODEL'}
            </div>
            <div style={{ fontSize: '10px', color: '#445566', letterSpacing: '0.03em' }}>
              {worldGenProgress.detail}
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#2a3a4a', letterSpacing: '0.08em', marginTop: '4px' }}>
            MARBLE 0.1-PLUS · 4 PERSPECTIVES · EST. 45-90 SECONDS
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Fallback banner */}
      {showFallback && (
        <div style={{
          position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(8,12,20,0.88)', border: '1px solid #1e2a3a', borderRadius: '4px',
          padding: '6px 14px', fontFamily: 'ui-monospace, monospace', fontSize: '10px',
          color: '#556677', letterSpacing: '0.08em', pointerEvents: 'none', backdropFilter: 'blur(4px)',
        }}>
          {splatUrl ? 'WORLD MODEL UNAVAILABLE — LABELS ACTIVE' : 'WORLD MODEL PENDING GENERATION'}
        </div>
      )}
    </div>
  );
}
