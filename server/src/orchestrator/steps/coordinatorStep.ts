import { runCoordinator } from "../../agents/coordinator.agent.js";
import type { OrchestratorEvent } from "../../types/events.js";
import type { TaskRecord } from "../../types/task.js";
import { progress } from "../pipelineEmit.js";
import type { PipelineStepDeps } from "../pipelineTypes.js";
import { beginAgentStep, completeAgentStep } from "./agentLifecycle.js";

export async function runCoordinatorStep(deps: PipelineStepDeps, task: TaskRecord): Promise<boolean> {
  const { emit, client, runCtx, store, fail } = deps;

  await emit({ type: "task_created", prompt: task.prompt } as OrchestratorEvent);
  await beginAgentStep({
    task,
    store,
    emit,
    phase: "coordinator",
    agent: "coordinator",
    status: "running",
  });
  await progress(emit, "coordinator", 0.1, "Formalizing task");

  const coord = await runCoordinator(client, runCtx());
  if (!coord.ok || !coord.data) {
    await fail(coord.error ?? "coordinator failed");
    return false;
  }
  task.artifacts.formalized = coord.data;
  await store.saveTask(task);
  await emit({
    type: "artifact_ready",
    agent: "coordinator",
    name: "formalized_task",
    summary: coord.data.title,
    content: JSON.stringify(coord.data, null, 2),
  } as OrchestratorEvent);
  await completeAgentStep(emit, "coordinator");
  return true;
}
