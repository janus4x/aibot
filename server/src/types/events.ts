export type AgentRole =
  | "coordinator"
  | "architect"
  | "decomposer"
  | "reviewer"
  | "devWorker"
  | "textWorker"
  | "composer"
  | "qa";

export type OrchestratorEventType =
  | "task_created"
  | "agent_started"
  | "agent_progress"
  | "artifact_ready"
  | "agent_done"
  | "subtask_queued"
  | "worker_spawned"
  | "dynamic_graph"
  | "stage_timing"
  | "error"
  | "pipeline_complete";

export interface BaseOrchestratorEvent {
  taskId: string;
  ts: number;
  type: OrchestratorEventType;
}

export interface TaskCreatedEvent extends BaseOrchestratorEvent {
  type: "task_created";
  prompt: string;
}

export interface AgentStartedEvent extends BaseOrchestratorEvent {
  type: "agent_started";
  agent: AgentRole;
  instanceId?: string;
  label?: string;
}

export interface AgentProgressEvent extends BaseOrchestratorEvent {
  type: "agent_progress";
  agent: AgentRole;
  instanceId?: string;
  progress: number;
  message?: string;
}

export interface ArtifactReadyEvent extends BaseOrchestratorEvent {
  type: "artifact_ready";
  agent: AgentRole;
  instanceId?: string;
  name: string;
  summary?: string;
  content?: string;
}

export interface AgentDoneEvent extends BaseOrchestratorEvent {
  type: "agent_done";
  agent: AgentRole;
  instanceId?: string;
  ok: boolean;
}

export interface SubtaskQueuedEvent extends BaseOrchestratorEvent {
  type: "subtask_queued";
  subtaskId: string;
  title: string;
}

export interface WorkerSpawnedEvent extends BaseOrchestratorEvent {
  type: "worker_spawned";
  workerIndex: number;
  subtaskId: string;
  /** Ключ роли из декомпозиции (essay, dev, …) */
  roleKey?: string;
  /** Подпись для UI из config/roles.yaml */
  roleLabel?: string;
}

export interface DynamicGraphNode {
  id: string;
  label: string;
  kind: "preflight" | "subtask" | "tail";
  position: { x: number; y: number };
  roleKey?: string;
}

export interface DynamicGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface DynamicGraphEvent extends BaseOrchestratorEvent {
  type: "dynamic_graph";
  nodes: DynamicGraphNode[];
  edges: DynamicGraphEdge[];
}

export interface StageTimingEvent extends BaseOrchestratorEvent {
  type: "stage_timing";
  stage: string;
  ms: number;
}

export interface ErrorEvent extends BaseOrchestratorEvent {
  type: "error";
  agent?: AgentRole;
  message: string;
  detail?: string;
}

export interface PipelineCompleteEvent extends BaseOrchestratorEvent {
  type: "pipeline_complete";
  success: boolean;
}

export type OrchestratorEvent =
  | TaskCreatedEvent
  | AgentStartedEvent
  | AgentProgressEvent
  | ArtifactReadyEvent
  | AgentDoneEvent
  | SubtaskQueuedEvent
  | WorkerSpawnedEvent
  | DynamicGraphEvent
  | StageTimingEvent
  | ErrorEvent
  | PipelineCompleteEvent;
