/** Mirrors server TaskRecord fields used in UI. */
export interface SubtaskView {
  id: string;
  title: string;
  description: string;
  targetPaths: string[];
  acceptanceCriteria: string;
  dependencies: string[];
  role: string;
}

export interface TaskArtifactsView {
  formalized?: {
    title: string;
    goals: string[];
    constraints: string[];
    attachmentSummary: string;
  };
  architecture?: { markdown: string };
  decomposition?: {
    subtasks: SubtaskView[];
    pipeline?: { skipComposer?: boolean; skipQa?: boolean };
  };
  review?: { approved: boolean; feedback: string };
  composedReadme?: string;
  qaReport?: string;
}

export interface WorkspaceFileEntry {
  path: string;
  content: string;
  truncated: boolean;
}

export interface TaskView {
  id: string;
  prompt: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  phase: string;
  error?: string;
  artifacts: TaskArtifactsView;
  subtasks: SubtaskView[];
  completedSubtaskIds: string[];
}
