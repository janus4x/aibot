/** Быстрая проверка доступности OpenAI-совместимого сервера (LM Studio). */
export async function checkLlmReachable(): Promise<{ ok: boolean; models?: unknown; error?: string }> {
  const base = (process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1").replace(/\/$/, "");
  const url = `${base}/models`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.LM_STUDIO_API_KEY ?? "lm-studio"}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: unknown[] };
    return { ok: true, models: data?.data ?? data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
