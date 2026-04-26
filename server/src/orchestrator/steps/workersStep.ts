import { runWorkerForSubtask } from "../../agents/workerDispatch.js";
import { resolveRoleLabel, resolveWorkerAgent } from "../../config/loadRolesConfig.js";
import type { ArchitectureDoc, Subtask } from "../../types/task.js";
import type { OrchestratorEvent } from "../../types/events.js";
import type { TaskRecord } from "../../types/task.js";
import type { PipelineStepDeps } from "../pipelineTypes.js";

export async function runWorkersStep(
  deps: PipelineStepDeps,
  task: TaskRecord,
  architecture: ArchitectureDoc,
  subtasks: Subtask[]
): Promise<boolean> {
  const { emit, client, runCtx, store, fail, taskId, orch } = deps;

  const completed = new Set<string>();
  const pending = new Set(subtasks.map((s) => s.id));

  while (pending.size) {
    const ready = subtasks.filter(
      (s) => pending.has(s.id) && s.dependencies.every((d) => completed.has(d))
    );
    if (!ready.length) {
      await fail("Subtask dependency deadlock or missing dependency id");
      return false;
    }
    const wave = ready.slice(0, orch.maxParallel);
    await Promise.all(
      wave.map(async (st, idx) => {
        const instanceId = `worker-${st.id}`;
        const roleLabel = resolveRoleLabel(st.role);
        await emit({
          type: "worker_spawned",
          workerIndex: idx,
          subtaskId: st.id,
          roleKey: st.role,
          roleLabel,
        } as OrchestratorEvent);

        await emit({
          type: "agent_started",
          agent: resolveWorkerAgent(st.role),
          instanceId,
          label: `${st.title} (${roleLabel})`,
        } as OrchestratorEvent);
        await emit({ type: "subtask_queued", subtaskId: st.id, title: st.title } as OrchestratorEvent);

        const res = await runWorkerForSubtask(client, runCtx(), architecture, st, instanceId);
        const wAgent = res.agent;
        if (!res.ok) {
          throw new Error(res.error ?? "worker failed");
        }
        const latest = (await store.getTask(taskId))!;
        latest.completedSubtaskIds.push(st.id);
        await store.saveTask(latest);
        Object.assign(task, latest);

        await emit({
          type: "artifact_ready",
          agent: wAgent,
          instanceId,
          name: `files_${st.id}`,
          summary: (res.data?.written ?? []).join(", "),
        } as OrchestratorEvent);
        await emit({ type: "agent_done", agent: wAgent, instanceId, ok: true } as OrchestratorEvent);
        completed.add(st.id);
        pending.delete(st.id);
      })
    );
  }

  return true;
}
