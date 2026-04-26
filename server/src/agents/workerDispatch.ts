import type OpenAI from "openai";
import { resolveWorkerAgent } from "../config/loadRolesConfig.js";
import { runDevWorker } from "./devWorker.agent.js";
import { runTextWorker } from "./textWorker.agent.js";
import type { AgentResult } from "../types/agent.js";
import type { AgentRole } from "../types/events.js";
import type { AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, Subtask } from "../types/task.js";

export async function runWorkerForSubtask(
  client: OpenAI,
  ctx: AgentRunContext,
  architecture: ArchitectureDoc,
  subtask: Subtask,
  instanceId: string
): Promise<AgentResult<{ written: string[] }> & { agent: AgentRole }> {
  const agent = resolveWorkerAgent(subtask.role);
  const label = `${subtask.title} [${subtask.role}]`;
  if (agent === "textWorker") {
    const r = await runTextWorker(client, ctx, architecture, subtask, instanceId);
    return { ...r, agent: "textWorker" };
  }
  const r = await runDevWorker(client, ctx, architecture, subtask, label);
  return { ...r, agent: "devWorker" };
}
