import { loadOrchestratorConfig } from "../config/loadOrchestratorConfig.js";

let active = 0;

export function tryAcquirePipelineSlot(): boolean {
  const max = loadOrchestratorConfig().maxConcurrentPipelines ?? 3;
  if (active >= max) return false;
  active += 1;
  return true;
}

export function releasePipelineSlot(): void {
  active = Math.max(0, active - 1);
}

export function activePipelineSlots(): number {
  return active;
}
