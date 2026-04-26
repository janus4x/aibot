import OpenAI from "openai";

/** Max delay allowed by `setTimeout` in JS engines (~24.8 days). */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Per-request timeout (ms) for the OpenAI HTTP client.
 * Local LM Studio + large `max_tokens` often exceeds 30+ minutes.
 *
 * - Default: **24 hours** (local dev first).
 * - `LLM_TIMEOUT_MS=0` → use max timer (~24.8 days), effectively unlimited on the client.
 * - Any positive number → used as-is (minimum 10 s).
 */
export function getLlmTimeoutMs(): number {
  const raw = process.env.LLM_TIMEOUT_MS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      if (n === 0) return MAX_TIMEOUT_MS;
      return Math.max(10_000, n);
    }
  }
  return 86_400_000; // 24 h default
}

let singleton: OpenAI | null = null;
let loggedTimeout = false;

export function createLlmClient(): OpenAI {
  const ms = getLlmTimeoutMs();
  if (!loggedTimeout) {
    loggedTimeout = true;
    const label =
      ms >= MAX_TIMEOUT_MS - 1000 ? "≈unlimited (client)" : `${(ms / 60_000).toFixed(1)} min`;
    console.info(`[llm] HTTP timeout for OpenAI client: ${ms} ms (${label})`);
  }
  if (!singleton) {
    const baseURL = process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1";
    singleton = new OpenAI({
      apiKey: process.env.LM_STUDIO_API_KEY ?? "lm-studio",
      baseURL,
      timeout: ms,
      maxRetries: 0,
    });
  }
  return singleton;
}
