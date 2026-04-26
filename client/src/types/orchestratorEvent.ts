import type { DynamicGraphEdgePayload, DynamicGraphNodePayload } from "../pipelineGraph";

/** Событие оркестратора с бэкенда (WebSocket / replay). */
export type OrchestratorEvent = {
  taskId: string;
  ts: number;
  type: string;
  agent?: string;
  instanceId?: string;
  label?: string;
  progress?: number;
  message?: string;
  name?: string;
  summary?: string;
  content?: string;
  ok?: boolean;
  subtaskId?: string;
  title?: string;
  workerIndex?: number;
  success?: boolean;
  detail?: string;
  nodes?: DynamicGraphNodePayload[];
  edges?: DynamicGraphEdgePayload[];
  roleKey?: string;
  roleLabel?: string;
  stage?: string;
  ms?: number;
};
