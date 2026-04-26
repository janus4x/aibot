import { resolveFromRoot } from "./paths.js";
import { readYamlFile } from "./loadYaml.js";

export type DbProvider = "sqlite" | "mongo";

export interface DatabaseConfigFile {
  provider: DbProvider;
  sqlite: { path: string };
  mongo: { uri: string; database: string };
}

export function loadDatabaseConfig(): DatabaseConfigFile {
  return readYamlFile<DatabaseConfigFile>(resolveFromRoot("config", "database.yaml"));
}

/** Effective provider: env TASK_STORE overrides file. */
export function effectiveDbProvider(): DbProvider {
  const fromEnv = process.env.TASK_STORE as DbProvider | undefined;
  if (fromEnv === "sqlite" || fromEnv === "mongo") return fromEnv;
  return loadDatabaseConfig().provider;
}
