import React from "react";
import { NODE_DEFAULTS } from "./WorkflowCanvas.jsx";

const PALETTE = [
  { type: "input", label: "Input", icon: "input", desc: "Text or URL trigger" },
  { type: "ai", label: "AI Agent", icon: "smart_toy", desc: "Groq LLM step" },
  { type: "logic", label: "Logic", icon: "call_split", desc: "Branch or delay" },
  { type: "output", label: "Output", icon: "output", desc: "Structured JSON result" },
  { type: "blog", label: "Blog Agent", icon: "article", desc: "Create & post via Studio" },
];

export default function NodePalette({ onAddNode }) {
  return (
    <aside className="w-[220px] shrink-0 bg-white border border-surface-variant rounded-lg p-4 flex flex-col gap-3 overflow-y-auto shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Add nodes</h3>
      <p className="text-[10px] text-slate-500 leading-relaxed">Drag onto the canvas or click to add.</p>
      {PALETTE.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/reactflow", item.type);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onAddNode?.(item.type)}
          className="p-3 rounded-lg border border-surface-variant bg-slate-50 cursor-grab active:cursor-grabbing hover:border-secondary hover:bg-white transition-colors"
        >
          <div className="flex items-center gap-2 text-primary text-sm font-semibold">
            <span className="material-symbols-outlined text-base text-secondary">{item.icon}</span>
            {item.label}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">{item.desc}</p>
        </div>
      ))}
    </aside>
  );
}
