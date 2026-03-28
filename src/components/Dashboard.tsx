'use client';

import { TownModel, AgentOutput, AgentStatus } from '@/types';
import AgentStatusCard from './AgentStatus';
import SimControls from './SimControls';
import CostTicker from './CostTicker';

interface DashboardProps {
  address: string;
  townModel: TownModel | null;
  efScale: number;
  windDirection: string;
  agentStatuses: Record<AgentOutput['agent'], AgentStatus>;
  agentOutputs: Partial<Record<AgentOutput['agent'], AgentOutput>>;
  simStatus: 'idle' | 'loading' | 'simulating' | 'complete' | 'error';
  onEfChange: (ef: number) => void;
  onWindChange: (dir: string) => void;
  onSimulate: () => void;
  errorMsg?: string;
}

const AGENTS: AgentOutput['agent'][] = ['path', 'structural', 'evacuation', 'response'];

const AGENT_LABELS: Record<AgentOutput['agent'], string> = {
  path: 'PATH ANALYSIS',
  structural: 'STRUCTURAL DMG',
  evacuation: 'EVACUATION',
  response: 'RESPONSE PLAN',
};

const AGENT_ICONS: Record<AgentOutput['agent'], string> = {
  path: '⌁',
  structural: '⬡',
  evacuation: '↗',
  response: '✦',
};

export default function Dashboard({
  address,
  townModel,
  efScale,
  windDirection,
  agentStatuses,
  agentOutputs,
  simStatus,
  onEfChange,
  onWindChange,
  onSimulate,
  errorMsg,
}: DashboardProps) {
  const structuralOutput = agentOutputs['structural'];
  const evacuationOutput = agentOutputs['evacuation'];
  const responseOutput = agentOutputs['response'];

  const damageLevels = structuralOutput?.data.damage_levels ?? {};
  const destroyed = Object.values(damageLevels).filter((v) => v === 'destroyed').length;
  const major = Object.values(damageLevels).filter((v) => v === 'major').length;
  const minor = Object.values(damageLevels).filter((v) => v === 'minor').length;
  const casualties =
    evacuationOutput?.data.estimated_casualties ??
    structuralOutput?.data.estimated_casualties ??
    0;
  const blockedRoads = [
    ...(structuralOutput?.data.blocked_roads ?? []),
    ...(evacuationOutput?.data.blocked_roads ?? []),
  ].length;

  const deployments = responseOutput?.data.deployments ?? [];

  const isSimulating = simStatus === 'simulating';
  const isComplete = simStatus === 'complete';
  const isLoading = simStatus === 'loading';
  const canSimulate = !!townModel && simStatus !== 'simulating';

  const agentsDone = AGENTS.filter((a) => agentStatuses[a] === 'complete').length;
  const progressPct = isComplete ? 100 : Math.round((agentsDone / AGENTS.length) * 100);

  return (
    <>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 4px #ef4444; }
          50% { box-shadow: 0 0 16px #ef4444, 0 0 32px #ef444444; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes count-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agent-enter {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .dashboard-scrollbar::-webkit-scrollbar { width: 3px; }
        .dashboard-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dashboard-scrollbar::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 2px; }
        .stat-value { animation: count-up 0.4s ease-out both; }
        .agent-row { animation: agent-enter 0.3s ease-out both; }
      `}</style>

      <div
        className="h-full flex flex-col overflow-y-auto dashboard-scrollbar relative"
        style={{ background: '#080c14', fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace' }}
      >
        {/* Scanline effect during simulation */}
        {isSimulating && (
          <div
            className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
            style={{ opacity: 0.03 }}
          >
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '2px',
                background: '#ef4444',
                animation: 'scanline 2s linear infinite',
              }}
            />
          </div>
        )}

        {/* Status bar */}
        <div
          className="shrink-0 px-4 py-2.5 flex items-center justify-between"
          style={{
            background: isSimulating
              ? 'rgba(239,68,68,0.06)'
              : isComplete
              ? 'rgba(74,222,128,0.04)'
              : '#0d1117',
            borderBottom: `1px solid ${isSimulating ? '#ef444433' : '#1e2a3a'}`,
            transition: 'all 0.5s ease',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isSimulating ? '#ef4444' : isComplete ? '#4ade80' : '#2a3a50',
                animation: isSimulating ? 'pulse-red 1.2s ease-in-out infinite' : 'none',
                transition: 'background 0.3s ease',
              }}
            />
            <span
              className="text-xs tracking-widest"
              style={{
                color: isSimulating ? '#ef4444' : isComplete ? '#4ade80' : '#3a4a5a',
                animation: isSimulating ? 'blink 2s ease-in-out infinite' : 'none',
              }}
            >
              {isSimulating
                ? 'SIMULATION ACTIVE'
                : isComplete
                ? 'SIMULATION COMPLETE'
                : isLoading
                ? 'LOADING AREA DATA'
                : 'STANDBY'}
            </span>
          </div>
          <div
            className="text-xs px-2 py-0.5 rounded-sm"
            style={{
              background: '#0d1a2a',
              color: '#22d3ee',
              border: '1px solid #22d3ee22',
              letterSpacing: '0.1em',
            }}
          >
            VULTR
          </div>
        </div>

        {/* Progress bar during simulation */}
        {(isSimulating || isComplete) && (
          <div style={{ height: '2px', background: '#0d1117', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progressPct}%`,
                background: isComplete
                  ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
                  : 'linear-gradient(90deg, #ef4444, #ff6b2b)',
                transition: 'width 0.6s ease',
                boxShadow: isComplete ? '0 0 8px #4ade8088' : '0 0 8px #ef444488',
              }}
            />
          </div>
        )}

        <div className="flex-1 p-4 flex flex-col gap-5">

          {/* Address */}
          {address && (
            <div>
              <SectionLabel>TARGET LOCATION</SectionLabel>
              <div
                className="mt-1.5 px-3 py-2 rounded-sm text-sm truncate"
                style={{
                  background: '#0d1117',
                  border: '1px solid #1e2a3a',
                  color: '#c8d8e8',
                  letterSpacing: '0.02em',
                }}
              >
                {address}
              </div>
            </div>
          )}

          {/* Sim Controls */}
          <SimControls
            efScale={efScale}
            windDirection={windDirection}
            onEfChange={onEfChange}
            onWindChange={onWindChange}
            onSimulate={onSimulate}
            disabled={!canSimulate}
            loading={isSimulating}
          />

          {errorMsg && (
            <div
              className="text-xs p-3 rounded-sm"
              style={{
                background: '#1a0808',
                color: '#ef4444',
                border: '1px solid #ef444433',
                lineHeight: '1.5',
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}

          {/* Area stats */}
          {townModel && (
            <div>
              <SectionLabel>AREA INVENTORY</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <AreaStat label="BUILDINGS" value={townModel.buildings.length.toLocaleString()} />
                <AreaStat label="POPULATION" value={`~${townModel.population_estimate.toLocaleString()}`} />
                <AreaStat label="ROAD SEGMENTS" value={townModel.roads.length.toLocaleString()} />
                <AreaStat label="INFRASTRUCTURE" value={townModel.infrastructure.length.toLocaleString()} />
              </div>
            </div>
          )}

          {/* Impact summary */}
          {(isSimulating || isComplete) && (
            <div>
              <SectionLabel>IMPACT ASSESSMENT</SectionLabel>
              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <ImpactStat
                    label="DESTROYED"
                    value={destroyed}
                    tier="critical"
                    loading={!structuralOutput}
                  />
                  <ImpactStat
                    label="CASUALTIES"
                    value={casualties}
                    tier="critical"
                    loading={!evacuationOutput && !structuralOutput}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <ImpactStat
                    label="MAJOR DAMAGE"
                    value={major}
                    tier="warning"
                    loading={!structuralOutput}
                  />
                  <ImpactStat
                    label="ROADS BLOCKED"
                    value={blockedRoads}
                    tier="warning"
                    loading={!structuralOutput && !evacuationOutput}
                  />
                </div>
                <ImpactStat
                  label="MINOR DAMAGE"
                  value={minor}
                  tier="minor"
                  loading={!structuralOutput}
                  wide
                />
              </div>
            </div>
          )}

          {/* Agent pipeline */}
          {(isSimulating || isComplete) && (
            <div>
              <SectionLabel>AGENT PIPELINE</SectionLabel>
              <div className="mt-2 space-y-1">
                {AGENTS.map((agent, i) => {
                  const status = agentStatuses[agent];
                  const isDone = status === 'complete';
                  const isRunning = status === 'running';

                  return (
                    <div
                      key={agent}
                      className="agent-row flex items-center gap-3 px-3 py-2.5 rounded-sm"
                      style={{
                        animationDelay: `${i * 0.08}s`,
                        background: isRunning
                          ? 'rgba(239,68,68,0.06)'
                          : isDone
                          ? 'rgba(74,222,128,0.04)'
                          : '#0d1117',
                        border: `1px solid ${
                          isRunning ? '#ef444433' : isDone ? '#4ade8022' : '#1e2a3a'
                        }`,
                        transition: 'all 0.4s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          color: isRunning ? '#ef4444' : isDone ? '#4ade80' : '#2a3a50',
                          animation: isRunning ? 'blink 1s ease-in-out infinite' : 'none',
                          minWidth: '16px',
                          textAlign: 'center',
                        }}
                      >
                        {AGENT_ICONS[agent]}
                      </span>
                      <span
                        className="text-xs flex-1"
                        style={{
                          color: isRunning ? '#c8d8e8' : isDone ? '#8899aa' : '#3a4a5a',
                          letterSpacing: '0.08em',
                          transition: 'color 0.3s ease',
                        }}
                      >
                        {AGENT_LABELS[agent]}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-sm"
                        style={{
                          background: isRunning ? '#ef444422' : isDone ? '#4ade8022' : '#1e2a3a',
                          color: isRunning ? '#ef4444' : isDone ? '#4ade80' : '#3a4a5a',
                          letterSpacing: '0.06em',
                          fontSize: '9px',
                        }}
                      >
                        {isRunning ? 'RUNNING' : isDone ? 'DONE' : 'WAIT'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Agent detail cards */}
              <div className="mt-2 space-y-1">
                {AGENTS.map((agent) =>
                  agentOutputs[agent] ? (
                    <AgentStatusCard
                      key={agent}
                      agent={agent}
                      status={agentStatuses[agent]}
                      output={agentOutputs[agent] ?? null}
                    />
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Response deployments */}
          {deployments.length > 0 && (
            <div>
              <SectionLabel>RESPONSE DEPLOYMENTS</SectionLabel>
              <div className="mt-2 space-y-1">
                {deployments.slice(0, 6).map((dep, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 items-start px-3 py-2 rounded-sm"
                    style={{ background: '#0d1117', border: '1px solid #1e2a3a' }}
                  >
                    <span
                      className="text-xs shrink-0 px-1.5 py-0.5 rounded-sm"
                      style={{
                        background: '#22d3ee15',
                        color: '#22d3ee',
                        border: '1px solid #22d3ee22',
                        letterSpacing: '0.06em',
                        fontSize: '9px',
                        marginTop: '1px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dep.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs leading-relaxed" style={{ color: '#556677' }}>
                      {dep.reason.length > 90 ? dep.reason.slice(0, 90) + '…' : dep.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost ticker */}
          {(isSimulating || isComplete) && (
            <div>
              <SectionLabel>COMPUTE COST</SectionLabel>
              <div className="mt-2">
                <CostTicker agentStatuses={agentStatuses} />
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs tracking-widest"
        style={{ color: '#3a4a5a', letterSpacing: '0.12em' }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: '1px', background: '#1e2a3a' }} />
    </div>
  );
}

function AreaStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-3 py-2 rounded-sm"
      style={{ background: '#0d1117', border: '1px solid #1e2a3a' }}
    >
      <div className="text-xs mb-0.5" style={{ color: '#3a4a5a', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: '#8899aa' }}>
        {value}
      </div>
    </div>
  );
}

function ImpactStat({
  label,
  value,
  tier,
  loading,
  wide,
}: {
  label: string;
  value: number;
  tier: 'critical' | 'warning' | 'minor';
  loading?: boolean;
  wide?: boolean;
}) {
  const colors = {
    critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: '#ef444433', glow: '#ef444466' },
    warning:  { text: '#f97316', bg: 'rgba(249,115,22,0.05)', border: '#f9731633', glow: 'transparent' },
    minor:    { text: '#ecc94b', bg: 'rgba(236,201,75,0.04)', border: '#ecc94b22', glow: 'transparent' },
  };
  const c = colors[tier];

  return (
    <div
      className={`px-3 py-2.5 rounded-sm ${wide ? 'col-span-2' : ''}`}
      style={{
        background: loading ? '#0d1117' : c.bg,
        border: `1px solid ${loading ? '#1e2a3a' : c.border}`,
        transition: 'all 0.5s ease',
      }}
    >
      <div className="text-xs mb-1" style={{ color: '#3a4a5a', letterSpacing: '0.1em' }}>
        {label}
      </div>
      {loading ? (
        <div
          style={{
            height: '24px',
            width: '40%',
            background: 'linear-gradient(90deg, #1e2a3a 25%, #2a3a50 50%, #1e2a3a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            borderRadius: '2px',
          }}
        />
      ) : (
        <div
          className="stat-value text-2xl font-bold"
          style={{
            color: c.text,
            textShadow: tier === 'critical' && value > 0 ? `0 0 20px ${c.glow}` : 'none',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {value.toLocaleString()}
        </div>
      )}
    </div>
  );
}
