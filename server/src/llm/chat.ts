import type OpenAI from "openai";
import type { AgentConfig } from "../types/agent.js";
import { createLlmClient } from "./client.js";
import { getPipelineSignal } from "../orchestrator/pipelineAbort.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  client: OpenAI,
  cfg: AgentConfig,
  messages: ChatMessage[],
  taskId?: string
): Promise<string> {
  const signal = taskId ? getPipelineSignal(taskId) : undefined;
  const res = await client.chat.completions.create({
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    ...(signal ? { signal } : {}),
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Empty LLM response");
  return text;
}

export function getDefaultClient(): OpenAI {
  return createLlmClient(); // singleton; timeout from LLM_TIMEOUT_MS / default 24h
}
