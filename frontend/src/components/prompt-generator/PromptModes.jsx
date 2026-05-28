import React from "react";
import { PROMPT_MODES } from "./promptConstants.js";

export default function PromptModes({ mode, onChange }) {
  return (
    <div>
      <span className="text-xs font-semibold text-slate-600 block mb-2">Prompt mode</span>
      <div className="flex flex-col gap-2">
        {PROMPT_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`text-left px-3 py-2 rounded-md border transition-colors ${
              mode === m.id
                ? "border-[#031634] bg-slate-100"
                : "border-surface-variant bg-white hover:bg-slate-50"
            }`}
          >
            <span className="text-sm font-semibold text-primary block">{m.label}</span>
            <span className="text-[10px] text-on-surface-variant">{m.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
