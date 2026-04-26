import fs from "node:fs";
import path from "node:path";
import { runComposer } from "../../agents/composer.agent.js";
import { runQa } from "../../agents/qa.agent.js";
import { pickReadmeForQa } from "../../util/readmeFallback.js";
import type { ArchitectureDoc, DecompositionResult, FormalizedTask, Subtask } from "../../types/task.js";
import type { OrchestratorEvent } from "../../types/events.js";
import type { TaskRecord } from "../../types/task.js";
import type { PipelineStepDeps } from "../pipelineTypes.js";

export async function runComposerAndQaStep(
  deps: PipelineStepDeps,
  task: TaskRecord,
  formalized: FormalizedTask,
  architecture: ArchitectureDoc,
  subtasks: Subtask[],
  decomposition: DecompositionResult
): Promise<boolean> {
  const { emit, client, runCtx, store, fail, dirs } = deps;
  const plan = decomposition.pipeline ?? {};

  let readmeForQa = "";

  if (!plan.skipComposer) {
    task.phase = "composer";
    task.activeAgent = "composer";
    await store.saveTask(task);
    await emit({ type: "agent_started", agent: "composer" } as OrchestratorEvent);
    const comp = await runComposer(
      client,
      runCtx(),
      formalized,
      architecture,
      subtasks,
      task.completedSubtaskIds
    );
    if (!comp.ok || !comp.data) {
      await fail(comp.error ?? "composer failed");
      return false;
    }
    const readmePath = path.join(dirs.workspace, "README.md");
    fs.writeFileSync(readmePath, comp.data.readme, "utf8");
    task.artifacts.composedReadme = comp.data.readme;
    readmeForQa = comp.data.readme;
    await store.saveTask(task);
    await emit({
      type: "artifact_ready",
      agent: "composer",
      name: "README.md",
      summary: "Composed README",
      content: comp.data.readme,
    } as OrchestratorEvent);
    await emit({ type: "agent_done", agent: "composer", ok: true } as OrchestratorEvent);
  } else {
    readmeForQa = pickReadmeForQa(dirs.workspace, task.prompt);
  }

  if (!plan.skipQa) {
    task.phase = "qa";
    task.activeAgent = "qa";
    await store.saveTask(task);
    await emit({ type: "agent_started", agent: "qa" } as OrchestratorEvent);
    const qaInput = readmeForQa || pickReadmeForQa(dirs.workspace, task.prompt);
    const qa = await runQa(client, runCtx(), qaInput, { skipComposer: !!plan.skipComposer });
    if (!qa.ok || !qa.data) {
      await fail(qa.error ?? "qa failed");
      return false;
    }
    task.artifacts.qaReport = qa.data.report;
    fs.writeFileSync(path.join(dirs.workspace, "QA_REPORT.md"), qa.data.report, "utf8");
    await store.saveTask(task);
    await emit({
      type: "artifact_ready",
      agent: "qa",
      name: "QA_REPORT.md",
      summary: "QA report",
      content: qa.data.report,
    } as OrchestratorEvent);
    await emit({ type: "agent_done", agent: "qa", ok: true } as OrchestratorEvent);
  }

  return true;
}

export async function finalizeSuccess(deps: PipelineStepDeps, task: TaskRecord): Promise<void> {
  const { emit, store } = deps;
  task.phase = "done";
  task.status = "completed";
  task.activeAgent = undefined;
  await store.saveTask(task);
  await emit({ type: "pipeline_complete", success: true } as OrchestratorEvent);
}
