import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

function AINode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell id={id} selected={selected} data={data} inputPosition={Position.Top} outputs={[{ id: "out", position: Position.Bottom }]}>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.model || "llama-3.3-70b-versatile"}
        onChange={(e) => update({ model: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="llama-3.3-70b-versatile">llama-3.3-70b</option>
        <option value="llama-3.1-8b-instant">llama-3.1-8b</option>
        <option value="deepseek-r1-distill-llama-70b">deepseek-r1</option>
      </select>
      <p className="text-[10px] text-on-surface-variant mt-2">Output format</p>
      <select
        className="nodrag nopan workflow-field w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.outputFormat || "summary"}
        onChange={(e) => update({ outputFormat: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="summary">Summary sections</option>
        <option value="json">JSON</option>
        <option value="report">Report</option>
        <option value="plain">Plain text</option>
      </select>
      <textarea
        className="nodrag nopan workflow-field mt-2 w-full text-[11px] bg-slate-50 border border-surface-variant rounded-md p-2 text-primary focus:outline-none focus:border-secondary"
        rows={2}
        placeholder="System prompt…"
        value={data?.systemPrompt || ""}
        onChange={(e) => update({ systemPrompt: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      />
      <p className="text-[10px] text-secondary font-mono mt-1">
        ~{(data?.estimatedCredits ?? 0.002).toFixed(4)} ALGO est.
      </p>
    </NodeShell>
  );
}

export default memo(AINode);
