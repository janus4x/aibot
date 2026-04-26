import type OpenAI from "openai";
import type { TaskStore } from "../store/types.js";
import type { AgentRunContext } from "../types/agent.js";
import type { OrchestratorConfig } from "../config/loadOrchestratorConfig.js";
import type { EmitFn } from "./pipelineEmit.js";

export interface PipelineStepDeps {
  taskId: string;
  store: TaskStore;
  emit: EmitFn;
  client: OpenAI;
  orch: OrchestratorConfig;
  dirs: { base: string; workspace: string; attachments: string };
  runCtx: (extra?: Partial<AgentRunContext>) => AgentRunContext;
  fail: (msg: string, detail?: string) => Promise<void>;
}
