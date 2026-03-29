'use client';

import { useEffect, useState } from 'react';
import type { Tip, AgentAnalysis } from '@/types';
import { useTipAnalysis, AGENT_ORDER } from '@/hooks/useTipAnalysis';
import type { AgentName, AgentState } from '@/hooks/useTipAnalysis';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statesFromAnalysis(a: AgentAnalysis | undefined): Record<AgentName, AgentState> {
  return {
    classifier:  a?.classifier  ? (a.classifier.threatLevel === 'critical' ? 'critical' : 'done') : 'idle',
    corroborator: a?.corroborator ? 'done' : 'idle',
    synthesizer: a?.synthesizer  ? 'done' : 'idle',
    recommender: a?.recommender  ? 'done' : 'idle',
  };
}

const DOT_COLOR: Record<AgentState, string> = {
  idle:     'rgba(255,255,255,0.2)',
  running:  '#f59e0b',
  done:     '#22c55e',
  critical: '#ef4444',
};

function AgentDot({ state }: { state: AgentState }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: DOT_COLOR[state],
        animation: state === 'running' ? 'receiptPulse 1s ease-in-out infinite' : undefined,
        flexShrink: 0,
      }}
    />
  );
}

function Bar({ filled, total = 12, color }: { filled: number; total?: number; color: string }) {
  const f = Math.max(0, Math.min(total, Math.round(filled)));
  return (
    <span style={{ fontFamily: 'monospace', letterSpacing: '-0.05em' }}>
      <span style={{ color }}>{'█'.repeat(f)}</span>
      <span style={{ color: 'rgba(255,255,255,0.08)' }}>{'░'.repeat(total - f)}</span>
    </span>
  );
}

function ThreatBar({ level }: { level: string }) {
  const map: Record<string, { filled: number; color: string; label: string }> = {
    info:     { filled: 4,  color: '#3b82f6', label: 'Info' },
    advisory: { filled: 8,  color: '#d97706', label: 'Advisory' },
    warning:  { filled: 10, color: '#ea580c', label: 'Warning' },
    critical: { filled: 12, color: '#dc2626', label: 'Critical' },
  };
  const cfg = map[level] ?? map['info'];
  return (
    <span>
      <Bar filled={cfg.filled} color={cfg.color} />
      <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 10 }}>{cfg.label}</span>
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  const color = value >= 70 ? '#22c55e' : value >= 40 ? '#d97706' : '#ef4444';
  return (
    <span>
      <Bar filled={Math.round((value / 100) * 12)} color={color} />
      <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 10 }}>{value}%</span>
    </span>
  );
}

const KV_KEY: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  minWidth: 90,
  flexShrink: 0,
};
const KV_VAL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)' };
const QUOTE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.2)',
  fontStyle: 'italic',
  lineHeight: 1.5,
  marginTop: 6,
};
const SEP: React.CSSProperties = {
  borderBottom: '1px dotted rgba(255,255,255,0.08)',
  marginBottom: 8,
  paddingBottom: 8,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={KV_KEY}>{label}</span>
      <span style={KV_VAL}>{children}</span>
    </div>
  );
}

function SectionHead({
  title,
  state,
}: {
  title: string;
  state: 'done' | 'skip' | 'running' | 'idle';
}) {
  const dotColor = state === 'done' ? '#22c55e' : state === 'running' ? '#f59e0b' : '#4b5563';
  const badge = state === 'done' ? 'DONE' : state === 'skip' ? 'SKIP' : state === 'running' ? '···' : '';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {title}
      </span>
      {badge && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          {badge}
        </span>
      )}
    </div>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  active_threat: '#ef4444',
  weather: '#3b82f6',
  infrastructure: '#f59e0b',
  general_safety: '#22c55e',
};

function msToHuman(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function offsetLabel(ms: number): string {
  if (ms === 0) return 'this tip';
  const sign = ms > 0 ? '+' : '−';
  const abs = Math.abs(ms);
  if (abs < 60000) return `${sign}${Math.round(abs / 1000)}s`;
  return `${sign}${Math.round(abs / 60000)}m`;
}

// ── Corroborating tips fetcher ────────────────────────────────────────────────

function useCorroboratingTipDescriptions(tipIds: string[]) {
  const [descs, setDescs] = useState<Record<string, string>>({});
  const key = tipIds.join(',');
  useEffect(() => {
    if (!key) return;
    Promise.all(
      tipIds.map((id) =>
        fetch(`/api/tips/${id}`)
          .then((r) => r.json())
          .then((t) => [id, (t.description as string | undefined)?.slice(0, 50) ?? '…'] as [string, string])
          .catch(() => [id, '…'] as [string, string]),
      ),
    ).then((pairs) => setDescs(Object.fromEntries(pairs)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return descs;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  tip: Tip;
}

export default function AnalysisReceipt({ tip }: Props) {
  const [expanded, setExpanded] = useState(false);

  const initialStates = statesFromAnalysis(tip.agentAnalysis);
  const { agentStates: liveStates, liveData } = useTipAnalysis(
    tip._id,
    expanded,
    initialStates,
  );

  // Merge: live state overrides initial if it's not idle
  const states: Record<AgentName, AgentState> = {} as Record<AgentName, AgentState>;
  for (const name of AGENT_ORDER) {
    states[name] = liveStates[name] !== 'idle' ? liveStates[name] : initialStates[name];
  }

  // Merge analysis: live data takes priority
  const analysis: AgentAnalysis = {
    ...tip.agentAnalysis,
    ...(liveData.classifier    ? { classifier:   liveData.classifier    as AgentAnalysis['classifier']   } : {}),
    ...(liveData.corroborator  ? { corroborator: liveData.corroborator  as AgentAnalysis['corroborator'] } : {}),
    ...(liveData.synthesizer   ? { synthesizer:  liveData.synthesizer   as AgentAnalysis['synthesizer']  } : {}),
    ...(liveData.recommender   ? { recommender:  liveData.recommender   as AgentAnalysis['recommender']  } : {}),
    totalProcessingMs: (liveData.totalProcessingMs as number | undefined) ?? tip.agentAnalysis?.totalProcessingMs,
    agentsRun:         (liveData.agentsRun         as number | undefined) ?? tip.agentAnalysis?.agentsRun,
  };

  const anyDone = AGENT_ORDER.some((n) => states[n] !== 'idle');
  const corrobTipIds = (analysis.corroborator?.corroboratingTips ?? []).map((t) => t.tipId);
  const corrobDescs = useCorroboratingTipDescriptions(expanded ? corrobTipIds : []);

  return (
    <>
      <style>{`
        @keyframes receiptPulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .receipt-expand {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: max-height 220ms ease-out, opacity 180ms ease-out;
        }
        .receipt-expand.open {
          max-height: 1200px;
          opacity: 1;
        }
      `}</style>

      {/* Collapsed toggle row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: 8,
          padding: '5px 0 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {expanded ? '▾' : '▸'}{' '}
          {!anyDone ? 'Processing…' : 'AI Analysis'}
        </span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {AGENT_ORDER.map((name) => (
            <AgentDot key={name} state={states[name]} />
          ))}
        </span>
      </button>

      {/* Expandable receipt */}
      <div className={`receipt-expand${expanded ? ' open' : ''}`}>
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: 6,
            padding: '10px 2px 4px',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {/* ── Classifier ─────────────────────────────────────────────── */}
          {analysis.classifier ? (
            <div style={SEP}>
              <SectionHead title="Classified" state="done" />
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} />
              <Row label="Category">
                <span style={{ color: CATEGORY_COLOR[tip.category] ?? '#888' }}>
                  {analysis.classifier.category}
                </span>
              </Row>
              <Row label="Threat">
                <ThreatBar level={analysis.classifier.threatLevel} />
              </Row>
              <Row label="Credibility">{analysis.classifier.credibility}/100</Row>
              {analysis.classifier.sourceType.length > 0 && (
                <Row label="Source">
                  {analysis.classifier.sourceType.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')}
                </Row>
              )}
              <Row label="Decay">{analysis.classifier.decayMinutes} min</Row>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />
              <div style={QUOTE}>"{analysis.classifier.reasoning}"</div>
            </div>
          ) : states.classifier !== 'idle' ? (
            <div style={SEP}>
              <SectionHead title="Classified" state={states.classifier === 'running' ? 'running' : 'idle'} />
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>Classifying…</div>
            </div>
          ) : null}

          {/* ── Corroborator ───────────────────────────────────────────── */}
          {analysis.corroborator ? (
            <div style={SEP}>
              <SectionHead
                title="Corroborated"
                state={analysis.corroborator.isEscalation ? 'done' : 'skip'}
              />
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} />
              {analysis.corroborator.corroboratingTips.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                  No nearby reports to cross-reference.
                  <br />Monitoring for corroboration.
                </div>
              ) : (
                <>
                  <Row label="Confidence">
                    <ConfBar value={analysis.corroborator.confidence} />
                  </Row>
                  <Row label="Matching">{analysis.corroborator.corroboratingTips.length} independent report{analysis.corroborator.corroboratingTips.length !== 1 ? 's' : ''}</Row>
                  <div style={{ margin: '6px 0 4px', color: 'rgba(255,255,255,0.4)', paddingLeft: 2 }}>
                    {analysis.corroborator.corroboratingTips.map((ct, i) => {
                      const isLast = i === analysis.corroborator!.corroboratingTips.length - 1;
                      const branch = isLast ? '└─' : '├─';
                      const desc = corrobDescs[ct.tipId] ?? '…';
                      return (
                        <div key={ct.tipId} style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{branch}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            "{desc}"
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                            {offsetLabel(ct.timeOffsetMs)}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>└─</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>this tip</span>
                    </div>
                  </div>
                </>
              )}
              <Row label="Contradictions">
                <span style={{ color: analysis.corroborator.contradictions > 0 ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>
                  {analysis.corroborator.contradictions}
                </span>
              </Row>
              <Row label="Escalated">
                {analysis.corroborator.isEscalation
                  ? <span style={{ color: '#ef4444' }}>YES → CRITICAL</span>
                  : <span style={{ color: 'rgba(255,255,255,0.3)' }}>NO</span>}
              </Row>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />
              <div style={QUOTE}>"{analysis.corroborator.reasoning}"</div>
            </div>
          ) : states.corroborator !== 'idle' ? (
            <div style={SEP}>
              <SectionHead title="Corroborated" state="running" />
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>Checking nearby reports…</div>
            </div>
          ) : null}

          {/* ── Synthesizer ─────────────────────────────────────────────── */}
          {analysis.synthesizer ? (
            <div style={SEP}>
              <SectionHead title="Synthesized" state="done" />
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginBottom: 8 }}>
                "{analysis.synthesizer.summary}"
              </div>
              <Row label="Affected">{analysis.synthesizer.affectedArea}</Row>
              <Row label="Confidence"><ConfBar value={analysis.synthesizer.confidence} /></Row>
              {analysis.synthesizer.keyFacts.length > 0 && (
                <Row label="Key facts">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {analysis.synthesizer.keyFacts.map((f, i) => (
                      <span key={i} style={{ color: 'rgba(255,255,255,0.55)' }}>• {f}</span>
                    ))}
                  </div>
                </Row>
              )}
            </div>
          ) : states.synthesizer !== 'idle' ? (
            <div style={SEP}>
              <SectionHead title="Synthesized" state="running" />
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>Building situation report…</div>
            </div>
          ) : null}

          {/* ── Recommender ─────────────────────────────────────────────── */}
          {analysis.recommender ? (
            <div style={SEP}>
              <SectionHead title="Recommended" state="done" />
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {analysis.recommender.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#f59e0b', flexShrink: 0 }}>⚠</span>
                    <span style={{ color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', flexShrink: 0, fontSize: 10, letterSpacing: '0.08em', minWidth: 64 }}>
                      {a.type}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{a.instruction}</span>
                  </div>
                ))}
              </div>
              {analysis.recommender.exitsUsed > 0 && (
                <Row label="Exits used">{analysis.recommender.exitsUsed} mapped</Row>
              )}
              {analysis.recommender.reasoning && (
                <>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />
                  <div style={QUOTE}>"{analysis.recommender.reasoning}"</div>
                </>
              )}
            </div>
          ) : states.recommender !== 'idle' ? (
            <div style={SEP}>
              <SectionHead title="Recommended" state="running" />
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>Generating guidance…</div>
            </div>
          ) : null}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {(analysis.totalProcessingMs != null || analysis.agentsRun != null) && (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {analysis.totalProcessingMs != null && `processed in ${msToHuman(analysis.totalProcessingMs)}`}
              {analysis.agentsRun != null && ` · ${analysis.agentsRun} agent${analysis.agentsRun !== 1 ? 's' : ''}`}
              {' · gemini-2.0-flash-lite'}
            </div>
          )}

          {!anyDone && (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
              Waiting for agents to process this flare…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
