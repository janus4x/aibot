import fs from "node:fs";
import path from "node:path";
import type { AgentConfig } from "../types/agent.js";
import type { AgentRole } from "../types/events.js";
import { resolveFromRoot } from "./paths.js";
import { readYamlFile } from "./loadYaml.js";

const cache = new Map<AgentRole, AgentConfig>();

export function loadAgentConfig(role: AgentRole): AgentConfig {
  const hit = cache.get(role);
  if (hit) return hit;

  const file = resolveFromRoot("config", "agents", `${role}.yaml`);
  const cfg = readYamlFile<AgentConfig>(file);
  if (cfg.role !== role) {
    throw new Error(`Config role mismatch in ${file}: expected ${role}, got ${cfg.role}`);
  }
  cache.set(role, cfg);
  return cfg;
}

export function loadSystemPrompt(role: AgentRole): string {
  const cfg = loadAgentConfig(role);
  const p = resolveFromRoot(cfg.systemPromptFile);
  return fs.readFileSync(p, "utf8");
}
