import path from "node:path";
import { getTaskStoreSync } from "../store/index.js";
import type { AgentRole, OrchestratorEvent } from "../types/events.js";
import { broadcastTask } from "../ws/hub.js";
import { resolveFromRoot } from "../config/paths.js";

export type EmitFn = (
  e: Omit<OrchestratorEvent, "taskId" | "ts"> & { taskId?: string }
) => Promise<void>;

export function taskDirs(taskId: string) {
  const base = resolveFromRoot("data", "tasks", taskId);
  return {
    base,
    attachments: path.join(base, "attachments"),
    workspace: path.join(base, "workspace"),
  };
}

function nowEvent<T extends Omit<OrchestratorEvent, "taskId" | "ts">>(taskId: string, e: T): OrchestratorEvent {
  return { ...e, taskId, ts: Date.now() } as unknown as OrchestratorEvent;
}

export function buildEmit(taskId: string): EmitFn {
  return async (e) => {
    const store = getTaskStoreSync();
    const full = nowEvent(taskId, e as OrchestratorEvent);
    await store.addEvent(taskId, full);
    broadcastTask(taskId, full);
  };
}

export async function progress(
  emit: EmitFn,
  agent: AgentRole,
  p: number,
  message?: string,
  instanceId?: string
): Promise<void> {
  await emit({
    type: "agent_progress",
    agent,
    progress: p,
    message,
    instanceId,
  } as OrchestratorEvent);
}
