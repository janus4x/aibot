import type { OrchestratorEvent } from "../types/events.js";

/** Fastify/`ws` compatible socket */
export interface WsSocket {
  readonly readyState: number;
  send(data: string): void;
  on(event: "close", cb: () => void): void;
}

const taskSockets = new Map<string, Set<WsSocket>>();

export function registerSocket(taskId: string, socket: WsSocket) {
  let set = taskSockets.get(taskId);
  if (!set) {
    set = new Set();
    taskSockets.set(taskId, set);
  }
  set.add(socket);
  socket.on("close", () => {
    set!.delete(socket);
    if (set!.size === 0) taskSockets.delete(taskId);
  });
}

export function broadcastTask(taskId: string, event: OrchestratorEvent) {
  const set = taskSockets.get(taskId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const s of set) {
    if (s.readyState === 1) s.send(payload);
  }
}
