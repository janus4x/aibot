import type { AgentRole } from "./events.js";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type PipelinePhase =
  | "coordinator"
  | "architect"
  | "decomposer"
  | "reviewer"
  | "workers"
  | "composer"
  | "qa"
  | "done";

export interface Subtask {
  id: string;
  title: string;
  description: string;
  targetPaths: string[];
  acceptanceCriteria: string;
  dependencies: string[];
  /**
   * Логическая роль шага (essay, writer, dev, editor, …).
   * Сопоставляется с `config/roles.yaml` → конкретный агент-воркер.
   */
  role: string;
}

/** Настройки хвоста пайплайна после воркеров — задаёт декомпозитор/архитектура задачи. */
export interface PipelinePlan {
  /** Не вызывать агента Composer (например, только тексты в файлах). */
  skipComposer?: boolean;
  /** Не вызывать QA. */
  skipQa?: boolean;
}

export interface FormalizedTask {
  title: string;
  goals: string[];
  constraints: string[];
  attachmentSummary: string;
}

export interface ArchitectureDoc {
  markdown: string;
}

export interface DecompositionResult {
  subtasks: Subtask[];
  pipeline?: PipelinePlan;
}

export interface ReviewResult {
  approved: boolean;
  feedback: string;
}

export interface TaskArtifacts {
  formalized?: FormalizedTask;
  architecture?: ArchitectureDoc;
  decomposition?: DecompositionResult;
  review?: ReviewResult;
  composedReadme?: string;
  qaReport?: string;
}

export interface TaskRecord {
  id: string;
  prompt: string;
  status: TaskStatus;
  phase: PipelinePhase;
  createdAt: number;
  updatedAt: number;
  artifacts: TaskArtifacts;
  attachmentPaths: string[];
  reviewAttempts: number;
  subtasks: Subtask[];
  completedSubtaskIds: string[];
  error?: string;
  activeAgent?: AgentRole;
  activeWorkerId?: string;
}
