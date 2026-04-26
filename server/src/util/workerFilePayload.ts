/** One file entry from devWorker / textWorker LLM JSON. */
export interface WorkerFileEntry {
  path: string;
  /** UTF-8 file body encoded as Base64 (single line / no raw newlines in JSON). */
  contentBase64?: string;
  /** Legacy: plain string (fragile for large code with quotes). */
  content?: string;
}

export function decodeWorkerFileBody(
  f: WorkerFileEntry
): { ok: true; body: string } | { ok: false; reason: string } {
  const b64 = f.contentBase64?.trim();
  if (b64) {
    const normalized = b64.replace(/\s/g, "");
    try {
      const body = Buffer.from(normalized, "base64").toString("utf8");
      return { ok: true, body };
    } catch {
      return { ok: false, reason: "невалидный contentBase64" };
    }
  }
  if (typeof f.content === "string" && f.content.length > 0) {
    return { ok: true, body: f.content };
  }
  return { ok: false, reason: "нет contentBase64 ни content" };
}
