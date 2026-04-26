import type { OrchestratorEvent } from "../types/orchestratorEvent";

export function formatEventLogLine(ev: OrchestratorEvent): string {
  if (ev.type === "stage_timing" && ev.stage != null && ev.ms != null) {
    return `[${ev.type}] ${ev.stage}: ${ev.ms} ms`;
  }
  return `[${ev.type}] ${JSON.stringify(ev)}`;
}
