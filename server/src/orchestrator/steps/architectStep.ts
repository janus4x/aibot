import { runArchitect } from "../../agents/architect.agent.js";
import type { FormalizedTask } from "../../types/task.js";
import type { OrchestratorEvent } from "../../types/events.js";
import type { TaskRecord } from "../../types/task.js";
import { progress } from "../pipelineEmit.js";
import type { PipelineStepDeps } from "../pipelineTypes.js";
import { beginAgentStep, completeAgentStep } from "./agentLifecycle.js";

export async function runArchitectStep(
  deps: PipelineStepDeps,
  task: TaskRecord,
  formalized: FormalizedTask
): Promise<boolean> {
  const { emit, client, runCtx, store, fail } = deps;

  await beginAgentStep({
    task,
    store,
    emit,
    phase: "architect",
    agent: "architect",
  });
  await progress(emit, "architect", 0.25, "Designing architecture");

  const arch = await runArchitect(client, runCtx(), formalized);
  if (!arch.ok || !arch.data) {
    await fail(arch.error ?? "architect failed");
    return false;
  }
  const architecture = arch.data;
  task.artifacts.architecture = architecture;
  await store.saveTask(task);
  await emit({
    type: "artifact_ready",
    agent: "architect",
    name: "architecture",
    summary: "Architecture document",
    content: architecture.markdown.slice(0, 12000),
  } as OrchestratorEvent);
  await completeAgentStep(emit, "architect");
  return true;
}
