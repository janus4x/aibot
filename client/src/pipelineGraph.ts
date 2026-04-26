import type { Edge, Node } from "@xyflow/react";

/** Стартовый граф: только этап до ревью; дальше приходит `dynamic_graph` с сервера. */
const PREFLIGHT: { id: string; label: string }[] = [
  { id: "coordinator", label: "Coordinator" },
  { id: "architect", label: "Architect" },
  { id: "decomposer", label: "Decomposer" },
  { id: "reviewer", label: "Reviewer" },
];

const NODE_X = 48;
const NODE_Y0 = 32;
const STEP_Y = 168;

export function buildPreflightGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = PREFLIGHT.map((s, i) => ({
    id: s.id,
    type: "agent",
    position: { x: NODE_X, y: NODE_Y0 + i * STEP_Y },
    data: { label: s.label },
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < PREFLIGHT.length - 1; i++) {
    const a = PREFLIGHT[i];
    const b = PREFLIGHT[i + 1];
    edges.push({
      id: `e-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      type: "smoothstep",
      animated: true,
    });
  }

  return { nodes, edges };
}

/** Обратная совместимость: то же, что preflight. */
export function buildPipelineGraph(): { nodes: Node[]; edges: Edge[] } {
  return buildPreflightGraph();
}

export type DynamicGraphNodePayload = {
  id: string;
  label: string;
  kind: "preflight" | "subtask" | "tail";
  position: { x: number; y: number };
  roleKey?: string;
};

export type DynamicGraphEdgePayload = {
  id: string;
  source: string;
  target: string;
};

export function reactFlowFromDynamic(
  nodes: DynamicGraphNodePayload[],
  edges: DynamicGraphEdgePayload[]
): { nodes: Node[]; edges: Edge[] } {
  const rfn: Node[] = nodes.map((n) => ({
    id: n.id,
    type: "agent",
    position: n.position,
    data: {
      label: n.label,
      subtitle: n.kind === "subtask" && n.roleKey ? `роль: ${n.roleKey}` : "",
      kind: n.kind,
    },
  }));
  const rfe: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: true,
  }));
  return { nodes: rfn, edges: rfe };
}

export function cloneGraphState(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n) => ({
      ...n,
      data: { ...(n.data as object) },
    })),
    edges: edges.map((e) => ({ ...e })),
  };
}
