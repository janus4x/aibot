import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, FormalizedTask, Subtask } from "../types/task.js";

export async function runComposer(
  client: OpenAI,
  ctx: AgentRunContext,
  formalized: FormalizedTask,
  architecture: ArchitectureDoc,
  subtasks: Subtask[],
  completedIds: string[]
): Promise<AgentResult<{ readme: string }>> {
  const cfg = loadAgentConfig("composer");
  const system = loadSystemPrompt("composer");
  const user = [
    `Formalized task:\n${JSON.stringify(formalized, null, 2)}`,
    `Architecture:\n${architecture.markdown.slice(0, 12000)}`,
    `Subtasks (summary):\n${JSON.stringify(subtasks, null, 2)}`,
    `Completed subtask ids:\n${completedIds.join(", ")}`,
    `Workspace: ${ctx.workDir}`,
  ].join("\n\n");

  const readme = await chatCompletion(
    client,
    cfg,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ctx.taskId
  );
  return { ok: true, data: { readme: readme.trim() } };
}
