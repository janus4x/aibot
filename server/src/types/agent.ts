import type { AgentRole } from "./events.js";

export interface AgentConfig {
  role: AgentRole;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptFile: string;
  qualityTier?: string;
}

export interface AgentRunContext {
  taskId: string;
  workDir: string;
  attachmentPaths: string[];
  /** Raw user prompt */
  userPrompt: string;
  /** Extra structured context from prior agents */
  priorArtifacts: Record<string, unknown>;
}

export interface AgentResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  artifacts?: { name: string; content: string }[];
}
