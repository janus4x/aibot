import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OrchestratorEvent } from "../types/events.js";
import type { TaskRecord } from "../types/task.js";
import { resolveFromRoot } from "../config/paths.js";
import { loadDatabaseConfig } from "../config/loadDatabaseConfig.js";
import type { TaskStore } from "./types.js";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export class SqliteTaskStore implements TaskStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    ensureDir(path.dirname(dbPath));
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        data TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
    `);
  }

  async createTask(prompt: string, attachmentPaths: string[]): Promise<TaskRecord> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const record: TaskRecord = {
      id,
      prompt,
      status: "pending",
      phase: "coordinator",
      createdAt: now,
      updatedAt: now,
      artifacts: {},
      attachmentPaths,
      reviewAttempts: 0,
      subtasks: [],
      completedSubtaskIds: [],
    };
    await this.saveTask(record);
    return record;
  }

  async getTask(id: string): Promise<TaskRecord | null> {
    const stmt = this.db.prepare("SELECT data FROM tasks WHERE id = ?");
    const row = stmt.get(id) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as TaskRecord;
  }

  async saveTask(record: TaskRecord): Promise<void> {
    record.updatedAt = Date.now();
    const data = JSON.stringify(record);
    const stmt = this.db.prepare("INSERT OR REPLACE INTO tasks (id, data, updated_at) VALUES (?, ?, ?)");
    stmt.run(record.id, data, record.updatedAt);
  }

  async listTasks(limit = 50): Promise<TaskRecord[]> {
    const stmt = this.db.prepare("SELECT data FROM tasks ORDER BY updated_at DESC LIMIT ?");
    const rows = stmt.all(limit) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as TaskRecord);
  }

  async addEvent(taskId: string, event: OrchestratorEvent): Promise<void> {
    const stmt = this.db.prepare("INSERT INTO events (task_id, data, ts) VALUES (?, ?, ?)");
    stmt.run(taskId, JSON.stringify(event), event.ts);
  }

  async getEvents(taskId: string): Promise<OrchestratorEvent[]> {
    const stmt = this.db.prepare("SELECT data FROM events WHERE task_id = ? ORDER BY id ASC");
    const rows = stmt.all(taskId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as OrchestratorEvent);
  }
}

export function createSqliteStore(): SqliteTaskStore {
  const cfg = loadDatabaseConfig();
  const rawPath = cfg.sqlite.path;
  const dbPath = path.isAbsolute(rawPath) ? rawPath : resolveFromRoot(rawPath);
  return new SqliteTaskStore(dbPath);
}
