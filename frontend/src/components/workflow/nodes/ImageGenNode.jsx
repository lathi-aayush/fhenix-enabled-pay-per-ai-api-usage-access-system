import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

function ImageGenNode({ id, data, selected }) {
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
      <p className="text-[10px] text-on-surface-variant">Gemini · Image render</p>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.aspectRatio || "16:9"}
        onChange={(e) => update({ aspectRatio: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="16:9">16:9</option>
        <option value="1:1">1:1</option>
        <option value="4:3">4:3</option>
        <option value="3:4">3:4</option>
      </select>
      <p className="text-[10px] text-secondary font-mono mt-1">
        ~{(data?.estimatedCredits ?? 0.006).toFixed(4)} ALGO est.
      </p>
    </NodeShell>
  );
}

export default memo(ImageGenNode);
