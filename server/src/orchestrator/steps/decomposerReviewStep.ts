import { runDecomposer } from "../../agents/decomposer.agent.js";
import { runReviewer } from "../../agents/reviewer.agent.js";
import type { ArchitectureDoc, FormalizedTask } from "../../types/task.js";
import type { OrchestratorEvent } from "../../types/events.js";
import type { TaskRecord } from "../../types/task.js";
import { progress } from "../pipelineEmit.js";
import type { PipelineStepDeps } from "../pipelineTypes.js";
import { beginAgentStep, completeAgentStep } from "./agentLifecycle.js";

export async function runDecomposerReviewLoop(
  deps: PipelineStepDeps,
  task: TaskRecord,
  formalized: FormalizedTask,
  architecture: ArchitectureDoc
): Promise<boolean> {
  const { emit, client, runCtx, store, fail, orch } = deps;

  task.phase = "decomposer";
  let review = task.artifacts.review;

  for (;;) {
    await beginAgentStep({
      task,
      store,
      emit,
      phase: "decomposer",
      agent: "decomposer",
    });
    await progress(emit, "decomposer", 0.45, "Splitting subtasks");

    const dec = await runDecomposer(
      client,
      runCtx({ priorArtifacts: { reviewFeedback: review?.feedback } }),
      formalized,
      architecture
    );
    if (!dec.ok || !dec.data) {
      await fail(dec.error ?? "decomposer failed");
      return false;
    }
    task.artifacts.decomposition = dec.data;
    task.subtasks = dec.data.subtasks;
    await store.saveTask(task);
    await emit({
      type: "artifact_ready",
      agent: "decomposer",
      name: "subtasks",
      summary: `${dec.data.subtasks.length} subtasks`,
      content: JSON.stringify(dec.data, null, 2),
    } as OrchestratorEvent);
    await completeAgentStep(emit, "decomposer");
    await beginAgentStep({
      task,
      store,
      emit,
      phase: "reviewer",
      agent: "reviewer",
    });
    await progress(emit, "reviewer", 0.55, "Reviewing decomposition");

    const rev = await runReviewer(client, runCtx(), formalized, architecture, dec.data);
    if (!rev.ok || !rev.data) {
      await fail(rev.error ?? "reviewer failed");
      return false;
    }
    review = rev.data;
    task.artifacts.review = review;
    task.reviewAttempts += 1;
    await store.saveTask(task);
    await emit({
      type: "artifact_ready",
      agent: "reviewer",
      name: "review",
      summary: rev.data.approved ? "approved" : "changes requested",
      content: JSON.stringify(rev.data, null, 2),
    } as OrchestratorEvent);
    await completeAgentStep(emit, "reviewer");

    if (rev.data.approved) break;
    if (task.reviewAttempts >= orch.maxReviewRounds) {
      await fail("Review did not approve within max rounds");
      return false;
    }
  }

  return true;
}
