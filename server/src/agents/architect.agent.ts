import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, FormalizedTask } from "../types/task.js";

export async function runArchitect(
  client: OpenAI,
  ctx: AgentRunContext,
  formalized: FormalizedTask
): Promise<AgentResult<ArchitectureDoc>> {
  const cfg = loadAgentConfig("architect");
  const system = loadSystemPrompt("architect");
  const user = [
    `Formalized task JSON:\n${JSON.stringify(formalized, null, 2)}`,
    `Original prompt:\n${ctx.userPrompt}`,
    `Attachments:\n${ctx.attachmentPaths.join("\n") || "(none)"}`,
  ].join("\n\n");

  const md = await chatCompletion(
    client,
    cfg,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ctx.taskId
  );
  return { ok: true, data: { markdown: md.trim() } };
}
