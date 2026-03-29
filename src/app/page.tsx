'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TownModel, AgentOutput, AgentStatus, SimulationState, SceneLabel } from '@/types';
import type { WorldGenProgress } from '@/components/SplatScene';
import { latLngToSplatSpace } from '@/lib/geo';
import Dashboard from '@/components/Dashboard';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });
const SplatScene = dynamic(() => import('@/components/SplatScene'), { ssr: false });

// Fallback splat used before/during world generation or when World Labs is unavailable.
const DEMO_SPLAT_URL = 'https://sparkjs.dev/assets/splats/snow-street.spz';

const SPLAT_SCALE = 0.1;
const LABEL_HEIGHT = 2.0;

const INITIAL_STATE: SimulationState = {
  status: 'idle',
  townModel: null,
  agentStatuses: { path: 'idle', structural: 'idle', evacuation: 'idle', response: 'idle' },
  agentOutputs:  { path: null,   structural: null,   evacuation: null,   response: null   },
  efScale: 4,
  windDirection: 'SW',
  address: '',
};

function buildSceneLabels(
  agentOutputs: Partial<Record<AgentOutput['agent'], AgentOutput>>,
  townModel: TownModel,
): SceneLabel[] {
  const result: SceneLabel[] = [];
  const { lat: cLat, lng: cLng } = townModel.center;
  for (const output of Object.values(agentOutputs)) {
    if (!output?.data.labels) continue;
    for (const label of output.data.labels) {
      result.push({
        id:       label.id,
        position: latLngToSplatSpace(label.position.lat, label.position.lng, cLat, cLng, SPLAT_SCALE, LABEL_HEIGHT),
        text:     label.text,
        severity: label.severity,
        details:  label.details,
      });
    }
  }
  return result;
}

export default function Home() {
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  const [showScene, setShowScene] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [splatUrl, setSplatUrl] = useState<string | null>(DEMO_SPLAT_URL);
  const [worldGenProgress, setWorldGenProgress] = useState<WorldGenProgress | null>(null);
  const [worldGenFailed, setWorldGenFailed] = useState(false);

  // Separate abort controllers for world gen and agent simulation
  const worldGenAbortRef = useRef<AbortController | null>(null);
  const simAbortRef = useRef<AbortController | null>(null);

  const agentOutputsFiltered = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(state.agentOutputs).filter(([, v]) => v !== null)
      ) as Partial<Record<AgentOutput['agent'], AgentOutput>>,
    [state.agentOutputs],
  );

  const sceneLabels = useMemo<SceneLabel[]>(() => {
    if (!state.townModel || Object.keys(agentOutputsFiltered).length === 0) return [];
    return buildSceneLabels(agentOutputsFiltered, state.townModel);
  }, [agentOutputsFiltered, state.townModel]);

  // ── World generation — fires on address select, runs in background ──────────
  const startWorldGen = useCallback(async (lat: number, lng: number, locationName: string) => {
    worldGenAbortRef.current?.abort();
    const controller = new AbortController();
    worldGenAbortRef.current = controller;

    setSplatUrl(DEMO_SPLAT_URL);
    setWorldGenFailed(false);
    setWorldGenProgress({ stage: 'streetview', detail: 'Starting world reconstruction…' });

    try {
      const res = await fetch('/api/generate-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, locationName }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setWorldGenProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue; }
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const evt = JSON.parse(raw);
            if (currentEvent === 'progress') {
              setWorldGenProgress({ stage: evt.stage ?? '', detail: evt.detail ?? '' });
            } else if (currentEvent === 'complete') {
              const proxied = evt.splatUrl
                ? evt.splatUrl.startsWith('/')
                  ? evt.splatUrl
                  : `/api/splat-proxy?url=${encodeURIComponent(evt.splatUrl)}`
                : null;
              setSplatUrl(proxied);
              setWorldGenProgress(null);
              break outer;
            } else if (currentEvent === 'error') {
              console.warn('[world-gen]', evt.message);
              setWorldGenProgress(null);
              setWorldGenFailed(true);
              break outer;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('[world-gen] failed, using fallback splat:', err);
      setWorldGenProgress(null);
      setWorldGenFailed(true);
    }
  }, []);

  // ── Address select — loads town model then kicks off world gen ───────────────
  const handleAddressSelect = useCallback(async (address: string) => {
    setState((s) => ({ ...s, status: 'loading', address, townModel: null }));
    setErrorMsg(undefined);

    try {
      const res  = await fetch('/api/town-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      setState((s) => ({ ...s, status: 'idle', townModel: json.townModel }));

      // Start world gen immediately — user configures EF scale while it runs
      startWorldGen(json.townModel.center.lat, json.townModel.center.lng, address);
    } catch (err) {
      setErrorMsg(`Failed to load area: ${err}`);
      setState((s) => ({ ...s, status: 'error' }));
    }
  }, [startWorldGen]);

  // ── Simulate — only runs agents, world gen is already underway ───────────────
  const handleSimulate = useCallback(async () => {
    if (!state.townModel) return;

    setState((s) => ({
      ...s,
      status: 'simulating',
      agentStatuses: { path: 'idle', structural: 'idle', evacuation: 'idle', response: 'idle' },
      agentOutputs:  { path: null,   structural: null,   evacuation: null,   response: null   },
    }));
    setErrorMsg(undefined);
    setShowScene(true);

    simAbortRef.current?.abort();
    const controller = new AbortController();
    simAbortRef.current = controller;

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          townModel:     state.townModel,
          efScale:       state.efScale,
          windDirection: state.windDirection,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Simulation request failed: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            if (event.type === 'done') {
              setState((s) => ({ ...s, status: 'complete' }));
              continue;
            }
            if (event.type === 'error') {
              setErrorMsg(event.message ?? 'Simulation error');
              setState((s) => ({ ...s, status: 'error' }));
              continue;
            }
            const output = event as AgentOutput;
            setState((s) => {
              const statuses = { ...s.agentStatuses };
              const outputs  = { ...s.agentOutputs  };
              if (output.type === 'update') {
                statuses[output.agent] = 'running';
              } else {
                statuses[output.agent] = 'complete';
                outputs[output.agent]  = output;
              }
              return { ...s, agentStatuses: statuses, agentOutputs: outputs };
            });
          } catch { /* ignore malformed events */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      setErrorMsg(`Simulation failed: ${err}`);
      setState((s) => ({ ...s, status: 'error' }));
    }
  }, [state.townModel, state.efScale, state.windDirection]);

  const handleReset = useCallback(() => {
    worldGenAbortRef.current?.abort();
    simAbortRef.current?.abort();
    setState(INITIAL_STATE);
    setShowScene(false);
    setErrorMsg(undefined);
    setSplatUrl(DEMO_SPLAT_URL);
    setWorldGenProgress(null);
    setWorldGenFailed(false);
  }, []);

  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{ background: '#0a0a0f', fontFamily: 'ui-monospace, monospace' }}
    >
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2"
        style={{
          background: 'rgba(8,10,18,0.96)',
          borderBottom: '1px solid #1e2a3a',
          backdropFilter: 'blur(8px)',
          height: '44px',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-mono font-bold tracking-widest" style={{ color: '#ef4444' }}>
            VORTEX
          </span>
          <span className="text-xs font-mono" style={{ color: '#2a3a50' }}>|</span>
          <span className="text-xs font-mono" style={{ color: '#3a4a5a' }}>
            AI TORNADO IMPACT SIMULATOR
          </span>
        </div>

        <div className="flex items-center gap-3">
          {showScene && (
            <button
              onClick={() => setShowScene(false)}
              className="text-xs font-mono px-3 py-1 rounded transition-colors"
              style={{ color: '#8899aa', border: '1px solid #1e2a3a' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f4f8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8899aa')}
            >
              ← MAP
            </button>
          )}
          {(state.status === 'simulating' || state.status === 'complete') && (
            <button
              onClick={handleReset}
              className="text-xs font-mono px-3 py-1 rounded transition-colors"
              style={{ color: '#8899aa', border: '1px solid #1e2a3a' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8899aa')}
            >
              RESET
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: worldGenProgress ? '#ff6b2b' : worldGenFailed ? '#ef4444' : '#4ade80',
                boxShadow: worldGenProgress ? '0 0 4px #ff6b2b' : worldGenFailed ? '0 0 4px #ef4444' : '0 0 4px #4ade80',
              }}
            />
            <span className="text-xs font-mono" style={{ color: worldGenProgress ? '#ff6b2b' : worldGenFailed ? '#ef4444' : '#4ade80' }}>
              {worldGenProgress ? 'BUILDING WORLD' : worldGenFailed ? 'WORLD GEN FAILED' : 'ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main 65/35 layout ──────────────────────────────────────────────── */}
      <div className="flex w-full" style={{ paddingTop: '44px' }}>

        {/* Left 65%: Map ↔ Splat Scene */}
        <div className="relative flex-1" style={{ minWidth: 0 }}>

          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: showScene ? 0 : 1, pointerEvents: showScene ? 'none' : 'auto' }}
          >
            <Map
              townModel={state.townModel}
              onAddressSelect={handleAddressSelect}
              loading={state.status === 'loading'}
            />
          </div>

          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: showScene ? 1 : 0, pointerEvents: showScene ? 'auto' : 'none' }}
          >
            {(showScene || state.status === 'simulating' || state.status === 'complete') && (
              <SplatScene
                splatUrl={splatUrl}
                labels={sceneLabels}
                townModel={state.townModel}
                worldGenProgress={worldGenProgress}
              />
            )}
          </div>

          {!showScene && state.townModel && state.status === 'idle' && (
            <button
              onClick={() => setShowScene(true)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded text-xs font-mono transition-all"
              style={{
                background: 'rgba(8,12,20,0.92)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#ef4444',
                backdropFilter: 'blur(4px)',
              }}
            >
              ▶ PREVIEW 3D SCENE
            </button>
          )}
        </div>

        {/* Right 35%: Dashboard */}
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: '35%',
            minWidth: '320px',
            maxWidth: '460px',
            borderLeft: '1px solid #1e2a3a',
          }}
        >
          <Dashboard
            address={state.address}
            townModel={state.townModel}
            efScale={state.efScale}
            windDirection={state.windDirection}
            agentStatuses={state.agentStatuses as Record<AgentOutput['agent'], AgentStatus>}
            agentOutputs={agentOutputsFiltered}
            simStatus={state.status}
            onEfChange={(ef) => setState((s) => ({ ...s, efScale: ef }))}
            onWindChange={(dir) => setState((s) => ({ ...s, windDirection: dir }))}
            onSimulate={handleSimulate}
            errorMsg={errorMsg}
          />
        </div>
      </div>
    </div>
  );
}
