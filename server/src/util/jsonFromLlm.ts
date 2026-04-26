import { jsonrepair } from "jsonrepair";

/** Remove one ``` / ```json fenced block if present (allows preamble before the fence). */
function stripMarkdownFences(raw: string): string {
  const t = raw.trim();
  const openIdx = t.indexOf("```");
  if (openIdx === -1) return t;
  const afterOpen = t.slice(openIdx + 3).replace(/^(json)?\s*/i, "");
  const closeIdx = afterOpen.indexOf("```");
  if (closeIdx !== -1) return afterOpen.slice(0, closeIdx).trim();
  return afterOpen.trim();
}

/** Drop leading prose; prefer the object that contains `filesWritten` (workers). */
function sliceJsonObjectStart(raw: string): string {
  const s = raw.trim();
  const re = /\{\s*"filesWritten"\s*:/;
  const m = re.exec(s);
  const i = m?.index ?? s.indexOf("{");
  if (i < 0) return s;
  return s.slice(i);
}

export function prepareLlmJsonText(raw: string): string {
  return sliceJsonObjectStart(stripMarkdownFences(raw));
}

/** Strip markdown fences, parse JSON; on failure try jsonrepair (common with LLM-escaped strings). */
export function parseJsonFromLlm<T>(raw: string): T {
  const t = prepareLlmJsonText(raw);
  try {
    return JSON.parse(t) as T;
  } catch {
    const repaired = jsonrepair(t);
    return JSON.parse(repaired) as T;
  }
}

export function tryParseJsonFromLlm<T>(
  raw: string
): { ok: true; value: T } | { ok: false; error: string } {
  const t = prepareLlmJsonText(raw);
  try {
    return { ok: true, value: JSON.parse(t) as T };
  } catch (e1) {
    try {
      const repaired = jsonrepair(t);
      return { ok: true, value: JSON.parse(repaired) as T };
    } catch (e2) {
      const msg1 = e1 instanceof Error ? e1.message : String(e1);
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      return { ok: false, error: `${msg1}; repair: ${msg2}` };
    }
  }
}
