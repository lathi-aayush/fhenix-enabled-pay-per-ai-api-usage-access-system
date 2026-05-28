import React from "react";
import { Handle, Position } from "@xyflow/react";
import { useNodeExecution } from "../../../context/NodeExecutionContext.jsx";

const STATUS_STYLES = {
  idle: "bg-slate-100 text-slate-600",
  queued: "bg-amber-50 text-amber-800",
  running: "bg-cyan-50 text-cyan-800 animate-pulse",
  success: "bg-emerald-50 text-emerald-800",
  completed: "bg-emerald-50 text-emerald-800",
  error: "bg-rose-50 text-rose-800",
};

export default function NodeShell({
  id,
  selected,
  data,
  children,
  inputPosition = Position.Top,
  outputs = [{ id: "out", position: Position.Bottom }],
}) {
  const { nodeStatuses } = useNodeExecution();
  const executionStatus = nodeStatuses[id] || "idle";

  return (
    <div
      className={`
        rounded-xl border px-4 py-3 min-w-[200px] cursor-pointer bg-white shadow-sm
        ${selected ? "border-[#031634] ring-2 ring-[#031634]/20" : "border-surface-variant"}
        ${executionStatus === "running" ? "border-cyan-500" : ""}
        ${executionStatus === "error" ? "border-rose-500" : ""}
      `}
    >
      {inputPosition && (
        <Handle type="target" position={inputPosition} className="!bg-[#031634] !w-2.5 !h-2.5" />
      )}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-primary">{data?.label || "Node"}</span>
        <div className="flex items-center gap-1">
          {selected && (
            <span className="text-[9px] text-slate-400" title="Delete: Del or Backspace">
              Del
            </span>
          )}
          <span
            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
              STATUS_STYLES[executionStatus] || STATUS_STYLES.idle
            }`}
          >
            {executionStatus}
          </span>
        </div>
      </div>
      {children}
      {outputs.map((o) => (
        <Handle
          key={o.id}
          id={o.id}
          type="source"
          position={o.position}
          className="!bg-secondary !w-2.5 !h-2.5"
        />
      ))}
    </div>
  );
}
