import React from "react";
import { QUICK_TEMPLATES } from "./promptConstants.js";

export default function PromptTemplates({ onSelect, activeLabel }) {
  return (
    <div>
      <span className="text-xs font-semibold text-slate-600 block mb-2">Quick templates</span>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={`text-left px-2.5 py-2 rounded-md border text-[11px] font-medium transition-colors ${
              activeLabel === t.label
                ? "border-[#031634] bg-slate-100 text-primary"
                : "border-surface-variant bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
