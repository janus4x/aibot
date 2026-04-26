import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (AgentMOD/) when running from server/src */
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

export function resolveFromRoot(...segments: string[]): string {
  return path.join(PROJECT_ROOT, ...segments);
}
