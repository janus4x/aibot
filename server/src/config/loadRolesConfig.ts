import { resolveFromRoot } from "./paths.js";
import { readYamlFile } from "./loadYaml.js";
import type { AgentRole } from "../types/events.js";

export interface RoleMapping {
  agent: AgentRole;
  uiLabel: string;
}

export interface RolesConfigFile {
  fallbackRole: string;
  mappings: Record<string, RoleMapping>;
}

let cached: RolesConfigFile | null = null;

export function loadRolesConfig(): RolesConfigFile {
  if (cached) return cached;
  cached = readYamlFile<RolesConfigFile>(resolveFromRoot("config", "roles.yaml"));
  return cached;
}

export function resolveWorkerAgent(roleKey: string): AgentRole {
  const cfg = loadRolesConfig();
  const m = cfg.mappings[roleKey] ?? cfg.mappings[cfg.fallbackRole];
  if (!m?.agent) return "devWorker";
  return m.agent;
}

export function resolveRoleLabel(roleKey: string): string {
  const cfg = loadRolesConfig();
  const m = cfg.mappings[roleKey] ?? cfg.mappings[cfg.fallbackRole];
  return m?.uiLabel ?? roleKey;
}
