import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

const EXTERNAL = [
  { id: "devto", label: "Dev.to" },
  { id: "medium", label: "Medium" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "hashnode", label: "Hashnode" },
];

function BlogNode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  const platforms = data?.platforms || ["devto"];

  const togglePlatform = (pid) => {
    const next = platforms.includes(pid) ? platforms.filter((p) => p !== pid) : [...platforms, pid];
    update({ platforms: next });
  };

  return (
    <NodeShell
      id={id}
      selected={selected}
      data={data}
      inputPosition={Position.Top}
      outputs={[]}
    >
      <p className="text-[10px] text-secondary font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-sm">article</span>
        Blog + Publish
      </p>
      <select
        className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white"
        value={data?.publishMode || "publish"}
        onChange={(e) => update({ publishMode: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="draft">Draft only</option>
        <option value="studio">Studio Published page</option>
        <option value="publish">Post to platforms</option>
      </select>
      {(data?.publishMode || "publish") === "publish" && (
        <div className="mt-2 flex flex-wrap gap-1">
          {EXTERNAL.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`nodrag nopan text-[9px] px-2 py-0.5 rounded border ${
                platforms.includes(p.id)
                  ? "bg-[#031634] text-white border-[#031634]"
                  : "bg-white text-slate-600"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlatform(p.id);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      {(data?.publishMode === "publish" || data?.publishMode === "studio") && (
        <div className="mt-2">
          <label className="text-[9px] text-slate-500 font-semibold block mb-0.5">Schedule</label>
          <input
            type="datetime-local"
            className="nodrag nopan workflow-field w-full text-[10px] border border-surface-variant rounded-md px-1.5 py-1 bg-white"
            value={data?.scheduledFor || ""}
            onChange={(e) => update({ scheduledFor: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-[8px] text-slate-400 mt-0.5">Leave empty to publish immediately</p>
        </div>
      )}
      <p className="text-[9px] text-slate-400 mt-1.5">Connect APIs in Studio → Platforms</p>
    </NodeShell>
  );
}

export default memo(BlogNode);
