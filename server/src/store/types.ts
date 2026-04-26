import type { OrchestratorEvent } from "../types/events.js";
import type { TaskRecord } from "../types/task.js";

export interface TaskStore {
  createTask(prompt: string, attachmentPaths: string[]): Promise<TaskRecord>;
  getTask(id: string): Promise<TaskRecord | null>;
  saveTask(record: TaskRecord): Promise<void>;
  listTasks(limit?: number): Promise<TaskRecord[]>;
  addEvent(taskId: string, event: OrchestratorEvent): Promise<void>;
  getEvents(taskId: string): Promise<OrchestratorEvent[]>;
}
