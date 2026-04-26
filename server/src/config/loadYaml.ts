import fs from "node:fs";
import YAML from "yaml";
import { expandEnvDeep } from "./expandEnv.js";

export function readYamlFile<T>(absPath: string): T {
  const raw = fs.readFileSync(absPath, "utf8");
  const parsed = YAML.parse(raw) as T;
  return expandEnvDeep(parsed);
}
