import { effectiveDbProvider } from "../config/loadDatabaseConfig.js";
import { createSqliteStore } from "./sqliteStore.js";
import { createMongoStore } from "./mongoStore.js";
import type { TaskStore } from "./types.js";

let cached: TaskStore | null = null;

export async function getTaskStore(): Promise<TaskStore> {
  if (cached) return cached;
  const p = effectiveDbProvider();
  if (p === "mongo") {
    cached = await createMongoStore();
  } else {
    cached = createSqliteStore();
  }
  return cached;
}

/** Sync getter after async init — use after server start */
export function getTaskStoreSync(): TaskStore {
  if (!cached) throw new Error("Task store not initialized");
  return cached;
}

export function setTaskStoreForTests(store: TaskStore) {
  cached = store;
}
