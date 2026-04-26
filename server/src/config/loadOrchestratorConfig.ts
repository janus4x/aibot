import { resolveFromRoot } from "./paths.js";
import { readYamlFile } from "./loadYaml.js";

export interface OrchestratorConfig {
  maxParallel: number;
  maxReviewRounds: number;
  /** Одновременных runPipeline (новые задачи получат 429, пока слоты заняты). */
  maxConcurrentPipelines?: number;
}

export function loadOrchestratorConfig(): OrchestratorConfig {
  const path = resolveFromRoot("config", "orchestrator.yaml");
  return readYamlFile<OrchestratorConfig>(path);
}
