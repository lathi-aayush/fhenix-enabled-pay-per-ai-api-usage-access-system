import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

function InputNode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell id={id} selected={selected} data={data} inputPosition={null} outputs={[{ id: "out", position: Position.Bottom }]}>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.inputType || "text"}
        onChange={(e) => update({ inputType: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="text">Text</option>
        <option value="youtube">YouTube URL</option>
        <option value="url">Other URL</option>
      </select>
      <textarea
        className="nodrag nopan workflow-field mt-2 w-full text-[11px] bg-slate-50 border border-surface-variant rounded-md p-2 text-primary focus:outline-none focus:border-secondary"
        rows={3}
        placeholder={
          data?.inputType === "youtube"
            ? "https://youtu.be/…"
            : "Enter prompt or data for this step…"
        }
        value={data?.value || ""}
        onChange={(e) => update({ value: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      />
    </NodeShell>
  );
}

export default memo(InputNode);
