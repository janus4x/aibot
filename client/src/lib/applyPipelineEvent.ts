import type { Node } from "@xyflow/react";
import type { OrchestratorEvent } from "../types/orchestratorEvent";

export function resetNodeData(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...(n.data as object), active: false, progress: 0 },
  }));
}

function subtaskNodeId(ev: Pick<OrchestratorEvent, "subtaskId" | "instanceId">): string | null {
  if (ev.subtaskId) return ev.subtaskId;
  const m = ev.instanceId?.match(/^worker-(.+)$/);
  return m ? m[1] : null;
}

/** Обновляет узлы React Flow по одному событию оркестратора. */
export function applyPipelineEvent(nodes: Node[], ev: OrchestratorEvent): Node[] {
  const next = nodes.map((n) => ({
    ...n,
    data: { ...(n.data as object) },
  }));

  const setAgent = (id: string, patch: Record<string, unknown>) => {
    const idx = next.findIndex((n) => n.id === id);
    if (idx < 0) return;
    next[idx] = {
      ...next[idx],
      data: { ...(next[idx].data as object), ...patch },
    };
  };

  const clearActive = () => {
    for (const n of next) {
      if (n.type === "agent") {
        (n.data as Record<string, unknown>).active = false;
        (n.data as Record<string, unknown>).progress = 0;
      }
    }
  };

  switch (ev.type) {
    case "agent_started": {
      clearActive();
      const agent = ev.agent ?? "";
      if ((agent === "devWorker" || agent === "textWorker") && ev.instanceId) {
        const nid = subtaskNodeId(ev);
        if (nid) {
          setAgent(nid, {
            active: true,
            progress: 0.15,
            subtitle: ev.label ?? "",
          });
        }
      } else if (agent && agent !== "devWorker" && agent !== "textWorker") {
        const nodeId = agent === "composer" ? "phase-composer" : agent === "qa" ? "phase-qa" : agent;
        setAgent(nodeId, { active: true, progress: 0.1, subtitle: "" });
      }
      break;
    }
    case "agent_progress": {
      const agent = ev.agent ?? "";
      if (agent === "devWorker" || agent === "textWorker") {
        const nid = subtaskNodeId(ev);
        if (nid) setAgent(nid, { active: true, progress: ev.progress ?? 0.5, subtitle: ev.message });
      } else {
        const nodeId = agent === "composer" ? "phase-composer" : agent === "qa" ? "phase-qa" : agent;
        setAgent(nodeId, { active: true, progress: ev.progress ?? 0.5 });
      }
      break;
    }
    case "agent_done": {
      const agent = ev.agent ?? "";
      if (agent === "devWorker" || agent === "textWorker") {
        const nid = subtaskNodeId(ev);
        if (nid) setAgent(nid, { active: false, progress: 1, subtitle: ev.ok ? "готово" : "ошибка" });
      } else {
        const nodeId = agent === "composer" ? "phase-composer" : agent === "qa" ? "phase-qa" : agent;
        setAgent(nodeId, { active: false, progress: 1 });
      }
      break;
    }
    case "worker_spawned": {
      const nid = ev.subtaskId;
      if (nid) {
        setAgent(nid, {
          active: true,
          progress: 0.12,
          subtitle: `${ev.roleLabel ?? ev.roleKey ?? ""} · ${ev.title ?? ""}`.trim(),
        });
      }
      break;
    }
    case "pipeline_complete": {
      clearActive();
      break;
    }
    default:
      break;
  }
  return next;
}
