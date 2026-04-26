import fs from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { loadAgentConfig, loadSystemPrompt } from "../config/loadAgentConfig.js";
import { chatCompletion } from "../llm/chat.js";
import type { AgentResult, AgentRunContext } from "../types/agent.js";

function listFilesRecursive(dir: string, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) listFilesRecursive(abs, base, out);
    else out.push(path.relative(base, abs).replace(/\\/g, "/"));
  }
  return out;
}

const SNIPPET_EXT = /\.(cpp|cc|cxx|c|h|hpp|hxx|sh|bat|cmd|cmake|txt|md|json|ya?ml|ts|js|py|rs|go)$/i;

/** Читает фрагменты ключевых файлов, чтобы QA сверял отчёт с фактическим кодом. */
function readWorkspaceSnippets(workDir: string, maxFiles = 14, maxCharsPerFile = 6000): string {
  const rels = listFilesRecursive(workDir)
    .filter((f) => !/QA_REPORT\.md$/i.test(f))
    .filter((f) => SNIPPET_EXT.test(f));
  const parts: string[] = [];
  for (const rel of rels.slice(0, maxFiles)) {
    const abs = path.join(workDir, rel);
    try {
      let text = fs.readFileSync(abs, "utf8");
      if (text.length > maxCharsPerFile) text = text.slice(0, maxCharsPerFile) + "\n… [обрезано]";
      parts.push(`Файл \`${rel}\`:\n\`\`\`\n${text}\n\`\`\``);
    } catch {
      /* skip unreadable */
    }
  }
  if (parts.length === 0) return "(нет подходящих текстовых файлов для фрагментов)";
  return parts.join("\n\n");
}

export async function runQa(
  client: OpenAI,
  ctx: AgentRunContext,
  readme: string,
  options?: { skipComposer?: boolean }
): Promise<AgentResult<{ report: string }>> {
  const cfg = loadAgentConfig("qa");
  const system = loadSystemPrompt("qa");
  const files = listFilesRecursive(ctx.workDir).slice(0, 200);
  const snippets = readWorkspaceSnippets(ctx.workDir);
  const composerNote = options?.skipComposer
    ? "Composer был пропущен: общий README мог не собираться; опирайся на список файлов и фрагменты ниже, не требуй отдельного README как обязательного артефакта."
    : "";
  const user = [
    `Исходный запрос пользователя:\n${ctx.userPrompt.slice(0, 8000)}`,
    composerNote,
    `README / описание для контекста (может быть пустым или кратким):\n${readme.slice(0, 8000)}`,
    `Files in workspace (${files.length}):\n${files.join("\n")}`,
    `Фрагменты исходников и файлов:\n${snippets}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const report = await chatCompletion(
    client,
    cfg,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ctx.taskId
  );
  return { ok: true, data: { report: report.trim() } };
}
