import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, DecompositionResult, FormalizedTask, ReviewResult } from "../types/task.js";
import { tryParseJsonFromLlm } from "../util/jsonFromLlm.js";

export async function runReviewer(
  client: OpenAI,
  ctx: AgentRunContext,
  formalized: FormalizedTask,
  architecture: ArchitectureDoc,
  decomposition: DecompositionResult
): Promise<AgentResult<ReviewResult>> {
  const cfg = loadAgentConfig("reviewer");
  const system = loadSystemPrompt("reviewer");
  const decJson = JSON.stringify(decomposition, null, 2);
  const user = [
    `Formalized task:\n${JSON.stringify(formalized, null, 2)}`,
    `Architecture excerpt (first 8000 chars):\n${architecture.markdown.slice(0, 8000)}`,
    `Decomposition (truncated if long):\n${decJson.slice(0, 14000)}${decJson.length > 14000 ? "\n…[truncated]" : ""}`,
  ].join("\n\n");

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await chatCompletion(
      client,
      cfg,
      [
        { role: "system", content: system },
        {
          role: "user",
          content: user + (attempt ? `\n\nValid JSON only. Error: ${lastErr}` : ""),
        },
      ],
      ctx.taskId
    );
    const parsed = tryParseJsonFromLlm<ReviewResult>(raw);
    if (parsed.ok && typeof parsed.value.approved === "boolean") {
      return { ok: true, data: parsed.value };
    }
    lastErr = parsed.ok ? "missing approved" : parsed.error;
  }
  return { ok: false, error: `Reviewer failed: ${lastErr}` };
}
