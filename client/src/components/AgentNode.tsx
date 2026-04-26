import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export type AgentNodeData = {
  label: string;
  active?: boolean;
  progress?: number;
  subtitle?: string;
};

export function AgentNode({ data }: NodeProps) {
  const d = data as AgentNodeData;
  const pct = Math.min(100, Math.max(0, Math.round((d.progress ?? 0) * 100)));
  return (
    <div className={`agent-node ${d.active ? "active pulse" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="title">{d.label}</div>
      {d.subtitle ? <div className="agent-node__sub">{d.subtitle}</div> : null}
      {d.active ? (
        <div className="progress-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
