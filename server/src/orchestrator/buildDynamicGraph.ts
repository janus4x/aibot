import { resolveRoleLabel } from "../config/loadRolesConfig.js";
import type { DynamicGraphEdge, DynamicGraphNode } from "../types/events.js";
import type { DecompositionResult, Subtask } from "../types/task.js";

const PREFLIGHT_X = 48;
const PREFLIGHT_Y0 = 32;
const PREFLIGHT_STEP = 140;

const WORK_X0 = 340;
const WORK_STEP_X = 240;
const WORK_ROW_Y = 100;

function sourceIds(subtasks: Subtask[]): string[] {
  return subtasks.filter((s) => s.dependencies.length === 0).map((s) => s.id);
}

/** Узлы-приёмники: на них не ссылаются как на зависимость (нет исходящих рёбер в графе подзадач). */
function sinkIds(subtasks: Subtask[]): string[] {
  const referenced = new Set<string>();
  for (const s of subtasks) {
    for (const d of s.dependencies) referenced.add(d);
  }
  return subtasks.filter((s) => !referenced.has(s.id)).map((s) => s.id);
}

function topoDepth(subtasks: Subtask[]): Map<string, number> {
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const memo = new Map<string, number>();

  function depth(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const s = byId.get(id);
    if (!s || s.dependencies.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    const d = Math.max(...s.dependencies.map(depth)) + 1;
    memo.set(id, d);
    return d;
  }
  for (const s of subtasks) depth(s.id);
  return memo;
}

export function buildDynamicGraphPayload(decomposition: DecompositionResult): {
  nodes: DynamicGraphNode[];
  edges: DynamicGraphEdge[];
} {
  const { subtasks, pipeline } = decomposition;
  const skipComposer = !!pipeline?.skipComposer;
  const skipQa = !!pipeline?.skipQa;

  const nodes: DynamicGraphNode[] = [];
  const edges: DynamicGraphEdge[] = [];

  const pre = ["coordinator", "architect", "decomposer", "reviewer"] as const;
  const preLabels: Record<string, string> = {
    coordinator: "Coordinator",
    architect: "Architect",
    decomposer: "Decomposer",
    reviewer: "Reviewer",
  };

  for (let i = 0; i < pre.length; i++) {
    const id = pre[i];
    nodes.push({
      id,
      label: preLabels[id],
      kind: "preflight",
      position: { x: PREFLIGHT_X, y: PREFLIGHT_Y0 + i * PREFLIGHT_STEP },
    });
    if (i > 0) {
      edges.push({
        id: `e-pre-${pre[i - 1]}-${id}`,
        source: pre[i - 1],
        target: id,
      });
    }
  }

  const depthMap = topoDepth(subtasks);
  const maxDepth = subtasks.length ? Math.max(...subtasks.map((s) => depthMap.get(s.id) ?? 0)) : 0;

  const byLayer = new Map<number, Subtask[]>();
  for (const s of subtasks) {
    const L = depthMap.get(s.id) ?? 0;
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L)!.push(s);
  }

  for (const [, group] of byLayer) {
    group.sort((a, b) => a.id.localeCompare(b.id));
  }

  for (const s of subtasks) {
    const L = depthMap.get(s.id) ?? 0;
    const layer = byLayer.get(L) ?? [];
    const idx = layer.findIndex((x) => x.id === s.id);
    const x = WORK_X0 + L * WORK_STEP_X;
    const y = PREFLIGHT_Y0 + idx * WORK_ROW_Y;
    nodes.push({
      id: s.id,
      label: `${s.title} (${resolveRoleLabel(s.role)})`,
      kind: "subtask",
      position: { x, y },
      roleKey: s.role,
    });
  }

  for (const sid of sourceIds(subtasks)) {
    edges.push({ id: `e-rev-${sid}`, source: "reviewer", target: sid });
  }

  for (const s of subtasks) {
    for (const d of s.dependencies) {
      edges.push({
        id: `e-dep-${d}-${s.id}`,
        source: d,
        target: s.id,
      });
    }
  }

  const sinks = sinkIds(subtasks);
  const tailCol = WORK_X0 + (maxDepth + 2) * WORK_STEP_X;

  if (!skipComposer) {
    nodes.push({
      id: "phase-composer",
      label: "Composer",
      kind: "tail",
      position: { x: tailCol, y: PREFLIGHT_Y0 },
    });
    for (const sid of sinks) {
      edges.push({ id: `e-${sid}-composer`, source: sid, target: "phase-composer" });
    }
  }

  if (!skipQa) {
    nodes.push({
      id: "phase-qa",
      label: "QA",
      kind: "tail",
      position: {
        x: tailCol + (skipComposer ? 0 : WORK_STEP_X),
        y: PREFLIGHT_Y0 + 80,
      },
    });
    if (!skipComposer) {
      edges.push({ id: `e-composer-qa`, source: "phase-composer", target: "phase-qa" });
    } else {
      for (const sid of sinks) {
        edges.push({ id: `e-${sid}-qa`, source: sid, target: "phase-qa" });
      }
    }
  }

  return { nodes, edges };
}
