import type { TaskStore } from "../../store/types.js";
import type { AgentRole, OrchestratorEvent } from "../../types/events.js";
import type { PipelinePhase, TaskRecord } from "../../types/task.js";
import type { EmitFn } from "../pipelineEmit.js";

interface BeginAgentStepParams {
  task: TaskRecord;
  store: TaskStore;
  emit: EmitFn;
  phase: PipelinePhase;
  agent: AgentRole;
  status?: TaskRecord["status"];
}

export async function beginAgentStep(params: BeginAgentStepParams): Promise<void> {
  const { task, store, emit, phase, agent, status } = params;
  if (status) task.status = status;
  task.phase = phase;
  task.activeAgent = agent;
  await store.saveTask(task);
  await emit({ type: "agent_started", agent } as OrchestratorEvent);
}

export async function completeAgentStep(emit: EmitFn, agent: AgentRole): Promise<void> {
  await emit({ type: "agent_done", agent, ok: true } as OrchestratorEvent);
}
