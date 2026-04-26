import fs from "node:fs";
import type { OrchestratorEvent } from "../types/events.js";
import { getDefaultClient } from "../llm/chat.js";
import { getTaskStoreSync } from "../store/index.js";
import { loadOrchestratorConfig } from "../config/loadOrchestratorConfig.js";
import type { AgentRunContext } from "../types/agent.js";
import { buildDynamicGraphPayload } from "./buildDynamicGraph.js";
import { buildEmit, taskDirs } from "./pipelineEmit.js";
import type { PipelineStepDeps } from "./pipelineTypes.js";
import { runArchitectStep } from "./steps/architectStep.js";
import { runCoordinatorStep } from "./steps/coordinatorStep.js";
import { runDecomposerReviewLoop } from "./steps/decomposerReviewStep.js";
import { runWorkersStep } from "./steps/workersStep.js";
import { finalizeSuccess, runComposerAndQaStep } from "./steps/tailStep.js";
import { clearPipelineAbort, isAbortError, registerPipelineAbort } from "./pipelineAbort.js";

export { taskDirs } from "./pipelineEmit.js";
export type { EmitFn } from "./pipelineEmit.js";

export async function runPipeline(taskId: string): Promise<void> {
  const store = getTaskStoreSync();
  const emit = buildEmit(taskId);
  const client = getDefaultClient();
  const orch = loadOrchestratorConfig();

  let task = await store.getTask(taskId);
  if (!task) throw new Error("task not found");

  registerPipelineAbort(taskId);

  const dirs = taskDirs(taskId);
  fs.mkdirSync(dirs.workspace, { recursive: true });

  const runCtx = (extra?: Partial<AgentRunContext>): AgentRunContext => ({
    taskId,
    workDir: dirs.workspace,
    attachmentPaths: task!.attachmentPaths,
    userPrompt: task!.prompt,
    priorArtifacts: extra?.priorArtifacts ?? {},
  });

  const fail = async (msg: string, detail?: string) => {
    task!.status = "failed";
    task!.error = msg;
    await store.saveTask(task!);
    await emit({ type: "error", message: msg, detail } as OrchestratorEvent);
    await emit({ type: "pipeline_complete", success: false } as OrchestratorEvent);
  };

  const deps: PipelineStepDeps = {
    taskId,
    store,
    emit,
    client,
    orch,
    dirs,
    runCtx,
    fail,
  };

  const timing = async (stage: string, started: number) => {
    await emit({
      type: "stage_timing",
      stage,
      ms: Date.now() - started,
    } as OrchestratorEvent);
  };

  try {
    let t = Date.now();
    if (!(await runCoordinatorStep(deps, task))) return;
    await timing("coordinator", t);

    const formalized = task.artifacts.formalized!;
    t = Date.now();
    if (!(await runArchitectStep(deps, task, formalized))) return;
    await timing("architect", t);

    const architecture = task.artifacts.architecture!;
    t = Date.now();
    if (!(await runDecomposerReviewLoop(deps, task, formalized, architecture))) return;
    await timing("decomposer_reviewer", t);

    const subtasks = task.subtasks;
    const decomposition = task.artifacts.decomposition!;

    const graphPayload = buildDynamicGraphPayload(decomposition);
    await emit({
      type: "dynamic_graph",
      nodes: graphPayload.nodes,
      edges: graphPayload.edges,
    } as OrchestratorEvent);

    task.phase = "workers";
    await store.saveTask(task);

    t = Date.now();
    if (!(await runWorkersStep(deps, task, architecture, subtasks))) return;
    await timing("workers", t);

    t = Date.now();
    if (!(await runComposerAndQaStep(deps, task, formalized, architecture, subtasks, decomposition))) return;
    await timing("composer_qa", t);

    await finalizeSuccess(deps, task);
  } catch (e) {
    if (isAbortError(e)) {
      task = (await store.getTask(taskId))!;
      task.status = "cancelled";
      task.error = "Отменено пользователем";
      await store.saveTask(task);
      await emit({ type: "error", message: "Отменено пользователем" } as OrchestratorEvent);
      await emit({ type: "pipeline_complete", success: false } as OrchestratorEvent);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    task = (await store.getTask(taskId))!;
    task.status = "failed";
    task.error = msg;
    await store.saveTask(task);
    await emit({ type: "error", message: msg } as OrchestratorEvent);
    await emit({ type: "pipeline_complete", success: false } as OrchestratorEvent);
  } finally {
    clearPipelineAbort(taskId);
  }
}
