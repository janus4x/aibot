import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { loadAgentConfig } from "../config/loadAgentConfig.js";
import { loadRolesConfig } from "../config/loadRolesConfig.js";
import { resolveFromRoot } from "../config/paths.js";
import { checkLlmReachable } from "../llm/llmHealth.js";
import { abortPipeline } from "../orchestrator/pipelineAbort.js";
import { releasePipelineSlot, tryAcquirePipelineSlot } from "../orchestrator/pipelineConcurrency.js";
import { runPipeline, taskDirs } from "../orchestrator/pipeline.js";
import { getTaskStore } from "../store/index.js";
import { readWorkspaceFiles } from "../util/readWorkspaceFiles.js";
import { registerSocket } from "../ws/hub.js";

export async function registerAppRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/health/llm", async () => checkLlmReachable());

  app.get("/api/config/models", async () => {
    try {
      const cfg = loadAgentConfig("coordinator");
      return { defaultModel: cfg.model, lmStudioBaseUrl: process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1" };
    } catch (e) {
      return { defaultModel: "unknown", error: String(e) };
    }
  });

  app.get("/api/tasks", async () => {
    const store = await getTaskStore();
    const tasks = await store.listTasks(100);
    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        promptPreview: t.prompt.length > 180 ? `${t.prompt.slice(0, 180)}…` : t.prompt,
        status: t.status,
        phase: t.phase,
        updatedAt: t.updatedAt,
        title: t.artifacts?.formalized?.title ?? null,
      })),
    };
  });

  app.get("/api/tasks/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const store = await getTaskStore();
    const task = await store.getTask(id);
    if (!task) return reply.code(404).send({ error: "Task not found" });
    const fb = loadRolesConfig().fallbackRole;
    const taskOut = {
      ...task,
      subtasks: task.subtasks.map((s) => ({ ...s, role: s.role ?? fb })),
    };
    return { task: taskOut };
  });

  app.get("/api/tasks/:id/events", async (req) => {
    const id = (req.params as { id: string }).id;
    const store = await getTaskStore();
    const events = await store.getEvents(id);
    return { events };
  });

  app.get("/api/tasks/:id/workspace", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const store = await getTaskStore();
    const task = await store.getTask(id);
    if (!task) return reply.code(404).send({ error: "Task not found" });
    const dirs = taskDirs(id);
    const files = readWorkspaceFiles(dirs.workspace);
    return { files };
  });

  app.get("/api/tasks/:id/export", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const store = await getTaskStore();
    const task = await store.getTask(id);
    if (!task) return reply.code(404).send({ error: "Task not found" });
    const events = await store.getEvents(id);
    const dirs = taskDirs(id);
    const files = readWorkspaceFiles(dirs.workspace);
    const payload = {
      exportedAt: Date.now(),
      task,
      events,
      workspaceIndex: files,
    };
    reply.header("Content-Disposition", `attachment; filename="agentmod-task-${id}.json"`);
    return reply.type("application/json").send(payload);
  });

  app.post("/api/tasks/:id/cancel", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const store = await getTaskStore();
    const task = await store.getTask(id);
    if (!task) return reply.code(404).send({ error: "Task not found" });
    if (task.status !== "running") {
      return reply.code(400).send({ error: "Задача не выполняется" });
    }
    const ok = abortPipeline(id);
    return { ok, aborted: ok };
  });

  app.post("/api/tasks", async (req, reply) => {
    let prompt = "";
    const files: { filename: string; data: Buffer }[] = [];

    for await (const part of req.parts()) {
      if (part.type === "field" && part.fieldname === "prompt") {
        prompt = String((part as { value?: string }).value ?? "");
      } else if (part.type === "file") {
        const data = await part.toBuffer();
        files.push({ filename: part.filename || "file.bin", data });
      }
    }

    if (!prompt.trim()) {
      return reply.code(400).send({ error: "prompt required" });
    }

    if (!tryAcquirePipelineSlot()) {
      return reply.code(429).send({
        error: "Достигнут лимит одновременных пайплайнов (maxConcurrentPipelines). Подождите завершения других задач.",
      });
    }

    const store = await getTaskStore();
    let task;
    try {
      task = await store.createTask(prompt, []);
      const dirs = taskDirs(task.id);
      fs.mkdirSync(dirs.attachments, { recursive: true });

      const savedPaths: string[] = [];
      for (const f of files) {
        const safe = path.basename(f.filename);
        const dest = path.join(dirs.attachments, safe);
        await fs.promises.writeFile(dest, f.data);
        savedPaths.push(dest);
      }
      task.attachmentPaths = savedPaths;
      await store.saveTask(task);
    } catch (e) {
      releasePipelineSlot();
      throw e;
    }

    setImmediate(() => {
      runPipeline(task.id)
        .catch((e) => app.log.error(e))
        .finally(() => releasePipelineSlot());
    });

    return { taskId: task.id, task };
  });

  app.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const taskId = url.searchParams.get("taskId");
    if (!taskId) {
      socket.close(1008, "taskId required");
      return;
    }
    registerSocket(taskId, socket);
  });
}

export function resolvePublicDir(): string {
  return resolveFromRoot("server", "public");
}
