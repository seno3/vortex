import type { Server as SocketIOServer } from 'socket.io';

export type AgentName = 'classifier' | 'corroborator' | 'synthesizer' | 'recommender';

export type AgentEvent =
  | { event: 'agent_start'; agent: AgentName }
  | { event: 'agent_done'; agent: AgentName; data: Record<string, unknown> }
  | { event: 'complete'; totalMs: number; agentsRun: number };

function getIO(): SocketIOServer | undefined {
  return (global as any).__socketIO;
}

export function emitTipAnalysis(tipId: string, payload: AgentEvent): void {
  getIO()?.to(`tip:${tipId}`).emit('tip:analysis', payload);
}
