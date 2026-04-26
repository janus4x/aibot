import fs from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";
import type { ArchitectureDoc, Subtask } from "../types/task.js";
import { tryParseJsonFromLlm } from "../util/jsonFromLlm.js";
import { decodeWorkerFileBody, type WorkerFileEntry } from "../util/workerFilePayload.js";
import { tryGppSyntaxOnly, validateWrittenContent } from "../util/validateWrittenCode.js";

interface DevWorkerJson {
  filesWritten: WorkerFileEntry[];
  notes?: string;
}

export async function runDevWorker(
  client: OpenAI,
  ctx: AgentRunContext,
  architecture: ArchitectureDoc,
  subtask: Subtask,
  workerLabel: string
): Promise<AgentResult<{ written: string[] }>> {
  const cfg = loadAgentConfig("devWorker");
  const system = loadSystemPrompt("devWorker");
  const user = [
    `Worker: ${workerLabel}`,
    `Subtask JSON:\n${JSON.stringify(subtask, null, 2)}`,
    `Architecture excerpt:\n${architecture.markdown.slice(0, 6000)}`,
    `Workspace root: ${ctx.workDir}`,
    `Attachment paths:\n${ctx.attachmentPaths.join("\n") || "(none)"}`,
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
              ? `\n\nReturn only fixed JSON with filesWritten and contentBase64 (UTF-8 base64). Error: ${lastErr}`
              : ""),
        },
      ],
      ctx.taskId
    );
    const parsed = tryParseJsonFromLlm<DevWorkerJson>(raw);
    if (!parsed.ok || !parsed.value.filesWritten?.length) {
      lastErr = parsed.ok ? "no filesWritten" : parsed.error;
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
      const heur = validateWrittenContent(rel, dec.body);
      if (!heur.ok) {
        decodeErr = heur.reason;
        break;
      }
      written.push(rel);
    }
    if (decodeErr) {
      lastErr = decodeErr;
      continue;
    }
    if (written.length === 0) {
      lastErr = "empty filesWritten";
      continue;
    }
    let compileErr = "";
    for (const rel of written) {
      const abs = path.join(ctx.workDir, rel);
      const syn = await tryGppSyntaxOnly(abs);
      if (!syn.ok) {
        compileErr = syn.reason;
        break;
      }
    }
    if (compileErr) {
      lastErr = compileErr;
      continue;
    }
    return { ok: true, data: { written }, artifacts: [{ name: "notes", content: parsed.value.notes ?? "" }] };
  }
  return { ok: false, error: `DevWorker failed: ${lastErr}` };
}
