import fs from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, Subtask } from "../types/task.js";
import { tryParseJsonFromLlm } from "../util/jsonFromLlm.js";
import { decodeWorkerFileBody, type WorkerFileEntry } from "../util/workerFilePayload.js";

interface TextWorkerJson {
  filesWritten: WorkerFileEntry[];
  notes?: string;
}

export async function runTextWorker(
  client: OpenAI,
  ctx: AgentRunContext,
  architecture: ArchitectureDoc,
  subtask: Subtask,
  workerLabel: string
): Promise<AgentResult<{ written: string[] }>> {
  const cfg = loadAgentConfig("textWorker");
  const system = loadSystemPrompt("textWorker");
  const user = [
    `Шаг: ${workerLabel}`,
    `Подзадача JSON:\n${JSON.stringify(subtask, null, 2)}`,
    `Архитектура (фрагмент):\n${architecture.markdown.slice(0, 6000)}`,
    `Корень workspace: ${ctx.workDir}`,
    `Вложения:\n${ctx.attachmentPaths.join("\n") || "(нет)"}`,
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
          content:
            user +
            (attempt
              ? `\n\nОтвет всё ещё невалиден. Верни только JSON с filesWritten и contentBase64 (UTF-8 base64). Ошибка: ${lastErr}`
              : ""),
        },
      ],
      ctx.taskId
    );
    const parsed = tryParseJsonFromLlm<TextWorkerJson>(raw);
    if (!parsed.ok || !parsed.value.filesWritten?.length) {
      lastErr = parsed.ok ? "нет filesWritten" : parsed.error;
      continue;
    }
    const written: string[] = [];
    let decodeErr = "";
    for (const f of parsed.value.filesWritten) {
      const dec = decodeWorkerFileBody(f);
      if (!dec.ok) {
        decodeErr = dec.reason;
        break;
      }
      const rel = f.path.replace(/\\/g, "/");
      const abs = path.join(ctx.workDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, dec.body, "utf8");
      written.push(rel);
    }
    if (decodeErr) {
      lastErr = decodeErr;
      continue;
    }
    if (written.length === 0) {
      lastErr = "пустой filesWritten";
      continue;
    }
    return { ok: true, data: { written }, artifacts: [{ name: "notes", content: parsed.value.notes ?? "" }] };
  }
  return { ok: false, error: `TextWorker failed: ${lastErr}` };
}
