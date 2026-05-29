import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

const CATEGORIES = [
  "Image Generation",
  "General",
  "Marketing",
  "Video / YouTube",
  "Content Creation",
];

function PromptGenNode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell
      id={id}
      selected={selected}
      data={data}
      inputPosition={Position.Top}
      outputs={[{ id: "out", position: Position.Bottom }]}
    >
      <p className="text-[10px] text-on-surface-variant">Gemini · Advanced Prompt Generator</p>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.category || "Image Generation"}
        onChange={(e) => update({ category: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.mode || "advanced"}
        onChange={(e) => update({ mode: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="beginner">Beginner</option>
        <option value="advanced">Advanced</option>
        <option value="expert">Expert</option>
      </select>
      <p className="text-[10px] text-secondary font-mono mt-1">
        ~{(data?.estimatedCredits ?? 0.004).toFixed(4)} ALGO est.
      </p>
    </NodeShell>
  );
}

export default memo(PromptGenNode);
