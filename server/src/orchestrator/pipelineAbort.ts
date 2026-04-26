/** Один AbortController на активный runPipeline(taskId) — для отмены HTTP к LLM. */
const controllers = new Map<string, AbortController>();

export function registerPipelineAbort(taskId: string): void {
  const prev = controllers.get(taskId);
  prev?.abort();
  controllers.set(taskId, new AbortController());
}

export function clearPipelineAbort(taskId: string): void {
  controllers.delete(taskId);
}

export function getPipelineSignal(taskId: string): AbortSignal | undefined {
  return controllers.get(taskId)?.signal;
}

export function abortPipeline(taskId: string): boolean {
  const c = controllers.get(taskId);
  if (!c) return false;
  c.abort();
  return true;
}

export function isAbortError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.name === "AbortError") return true;
    const m = e.message.toLowerCase();
    if (m.includes("abort")) return true;
    if (m.includes("user aborted")) return true;
  }
  return false;
}
