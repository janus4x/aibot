import type { Collection, MongoClient } from "mongodb";
import type { OrchestratorEvent } from "../types/events.js";
import type { TaskRecord } from "../types/task.js";
import { loadDatabaseConfig } from "../config/loadDatabaseConfig.js";
import type { TaskStore } from "./types.js";

interface TaskDoc {
  _id: string;
  data: TaskRecord;
}

interface EventDoc {
  _id?: import("mongodb").ObjectId;
  taskId: string;
  event: OrchestratorEvent;
}

export class MongoTaskStore implements TaskStore {
  private client: MongoClient;
  private tasks: Collection<TaskDoc>;
  private events: Collection<EventDoc>;

  constructor(client: MongoClient, dbName: string) {
    this.client = client;
    const db = client.db(dbName);
    this.tasks = db.collection<TaskDoc>("tasks");
    this.events = db.collection<EventDoc>("events");
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
    const doc = await this.tasks.findOne({ _id: id });
    return doc?.data ?? null;
  }

  async saveTask(record: TaskRecord): Promise<void> {
    record.updatedAt = Date.now();
    await this.tasks.updateOne(
      { _id: record.id },
      { $set: { _id: record.id, data: record } },
      { upsert: true }
    );
  }

  async listTasks(limit = 50): Promise<TaskRecord[]> {
    const docs = await this.tasks.find({}).toArray();
    docs.sort((a, b) => (b.data.updatedAt ?? 0) - (a.data.updatedAt ?? 0));
    return docs.slice(0, limit).map((d) => d.data);
  }

  async addEvent(taskId: string, event: OrchestratorEvent): Promise<void> {
    await this.events.insertOne({ taskId, event });
  }

  async getEvents(taskId: string): Promise<OrchestratorEvent[]> {
    const docs = await this.events.find({ taskId }).sort({ _id: 1 }).toArray();
    return docs.map((d) => d.event);
  }
}

let mongoSingleton: MongoTaskStore | null = null;

export async function createMongoStore(): Promise<MongoTaskStore> {
  if (mongoSingleton) return mongoSingleton;
  const cfg = loadDatabaseConfig();
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(cfg.mongo.uri);
  await client.connect();
  mongoSingleton = new MongoTaskStore(client, cfg.mongo.database);
  return mongoSingleton;
}
