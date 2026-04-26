import type OpenAI from "openai";
import { loadRolesConfig } from "../config/loadRolesConfig.js";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, DecompositionResult, FormalizedTask, Subtask } from "../types/task.js";
import { tryParseJsonFromLlm } from "../util/jsonFromLlm.js";

function normalizeDecomposition(
  raw: { subtasks: Partial<Subtask>[]; pipeline?: DecompositionResult["pipeline"] }
): DecompositionResult {
  const fb = loadRolesConfig().fallbackRole;
  const subtasks: Subtask[] = raw.subtasks.map((s, i) => {
    const id = typeof s.id === "string" && s.id ? s.id : `st-${i + 1}`;
    const role =
      typeof s.role === "string" && s.role.trim() ? s.role.trim() : fb;
    return {
      id,
      title: String(s.title ?? id),
      description: String(s.description ?? ""),
      targetPaths: Array.isArray(s.targetPaths) ? s.targetPaths : [],
      acceptanceCriteria: String(s.acceptanceCriteria ?? ""),
      dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
      role,
    };
  });
  return {
    subtasks,
    pipeline: {
      skipComposer: !!raw.pipeline?.skipComposer,
      skipQa: !!raw.pipeline?.skipQa,
    },
  };
}

export async function runDecomposer(
  client: OpenAI,
  ctx: AgentRunContext,
  formalized: FormalizedTask,
  architecture: ArchitectureDoc
): Promise<AgentResult<DecompositionResult>> {
  const cfg = loadAgentConfig("decomposer");
  const system = loadSystemPrompt("decomposer");
  const user = [
    `Formalized task:\n${JSON.stringify(formalized, null, 2)}`,
    `Architecture:\n${architecture.markdown}`,
    `Feedback from reviewer (if any):\n${String((ctx.priorArtifacts as { reviewFeedback?: string }).reviewFeedback ?? "")}`,
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
          content: user + (attempt ? `\n\nReturn valid JSON only. Error before: ${lastErr}` : ""),
        },
      ],
      ctx.taskId
    );
    const parsed = tryParseJsonFromLlm<{ subtasks: Partial<Subtask>[]; pipeline?: DecompositionResult["pipeline"] }>(
      raw
    );
    if (parsed.ok && Array.isArray(parsed.value.subtasks) && parsed.value.subtasks.length > 0) {
      return { ok: true, data: normalizeDecomposition(parsed.value) };
    }
    lastErr = parsed.ok ? "empty subtasks" : parsed.error;
  }
  return { ok: false, error: `Decomposer failed: ${lastErr}` };
}
