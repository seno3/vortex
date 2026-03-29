'use client';
import { useEffect, useRef, useState } from 'react';
import type { AgentName } from '@/lib/socket';

export type AgentState = 'idle' | 'running' | 'done' | 'critical';
export type { AgentName };

export const AGENT_ORDER: AgentName[] = ['classifier', 'corroborator', 'synthesizer', 'recommender'];

// Singleton socket — one connection shared across all tip receipts
let _socket: import('socket.io-client').Socket | null = null;
async function getSocket() {
  if (!_socket) {
    const { io } = await import('socket.io-client');
    _socket = io({ autoConnect: true, reconnectionDelay: 1000 });
  }
  return _socket;
}

export function useTipAnalysis(
  tipId: string,
  _enabled: boolean,
  initialStates: Record<AgentName, AgentState>,
) {
  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(initialStates);
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});

  // Reset when tip changes
  useEffect(() => {
    setAgentStates(initialStates);
    setLiveData({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipId]);

  useEffect(() => {
    let active = true;
    let off: (() => void) | null = null;

    getSocket().then((socket) => {
      if (!active) return;
      socket.emit('join:tip', tipId);

      const handler = (payload: {
        event: string;
        agent?: AgentName;
        data?: Record<string, unknown>;
        totalMs?: number;
        agentsRun?: number;
      }) => {
        if (!active) return;
        if (payload.event === 'agent_start' && payload.agent) {
          setAgentStates((p) => ({ ...p, [payload.agent!]: 'running' }));
        } else if (payload.event === 'agent_done' && payload.agent && payload.data) {
          const isCritical =
            payload.agent === 'classifier' &&
            (payload.data as any)?.threatLevel === 'critical';
          setAgentStates((p) => ({
            ...p,
            [payload.agent!]: isCritical ? 'critical' : 'done',
          }));
          setLiveData((p) => ({ ...p, [payload.agent!]: payload.data }));
        } else if (payload.event === 'complete') {
          setLiveData((p) => ({
            ...p,
            totalProcessingMs: payload.totalMs,
            agentsRun: payload.agentsRun,
          }));
        }
      };

      socket.on('tip:analysis', handler);
      off = () => {
        socket.off('tip:analysis', handler);
        socket.emit('leave:tip', tipId);
      };
    });

    return () => {
      active = false;
      off?.();
    };
  }, [tipId]);

  return { agentStates, liveData };
}
