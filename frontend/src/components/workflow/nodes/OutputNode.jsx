import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

const FORMATS = [
  { value: "summary", label: "Summary (sections)" },
  { value: "json", label: "JSON schema" },
  { value: "report", label: "Full report" },
];

function OutputNode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell id={id} selected={selected} data={data} inputPosition={Position.Top} outputs={[]}>
      <p className="text-[10px] text-on-surface-variant mb-1">Structured format</p>
      <select
        className="nodrag nopan workflow-field w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.outputFormat || "summary"}
        onChange={(e) => update({ outputFormat: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        {FORMATS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <p className="text-[9px] text-slate-400 mt-1.5">Final panel shows title, summary, bullets</p>
    </NodeShell>
  );
}

export default memo(OutputNode);
