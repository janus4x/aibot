import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { FormalizedTask } from "../types/task.js";
import { tryParseJsonFromLlm } from "../util/jsonFromLlm.js";

export async function runCoordinator(
  client: OpenAI,
  ctx: AgentRunContext
): Promise<AgentResult<FormalizedTask>> {
  const cfg = loadAgentConfig("coordinator");
  const system = loadSystemPrompt("coordinator");
  const user = [
    `User task:\n${ctx.userPrompt}`,
    `Attachment paths (read externally if needed):\n${ctx.attachmentPaths.join("\n") || "(none)"}`,
  ].join("\n\n");

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await chatCompletion(
      client,
      cfg,
      [
        { role: "system", content: system },
        { role: "user", content: user + (attempt ? `\n\nFix JSON. Previous error: ${lastErr}` : "") },
      ],
      ctx.taskId
    );
    const parsed = tryParseJsonFromLlm<FormalizedTask>(raw);
    if (parsed.ok && parsed.value.title && Array.isArray(parsed.value.goals)) {
      return { ok: true, data: parsed.value };
    }
    lastErr = parsed.ok ? "invalid shape" : parsed.error;
  }
  return { ok: false, error: `Coordinator JSON parse failed: ${lastErr}` };
}
