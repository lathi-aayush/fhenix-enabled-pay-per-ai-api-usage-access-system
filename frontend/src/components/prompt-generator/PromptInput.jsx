import React from "react";
import PromptModes from "./PromptModes.jsx";
import PromptTemplates from "./PromptTemplates.jsx";
import { PROMPT_CATEGORIES, PROMPT_TYPES } from "./promptConstants.js";

const labelClass = "text-xs font-semibold text-slate-600 block mb-1";
const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white";
const selectClass = "w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white";

export default function PromptInput({
  form,
  updateForm,
  applyTemplate,
  enhanceEnabled,
  setEnhanceEnabled,
  existingPrompt,
  setExistingPrompt,
  onGenerate,
  onEnhance,
  loading,
  atCap,
}) {
  return (
    <aside className="w-full xl:w-[300px] shrink-0 space-y-4 bg-white border border-surface-variant rounded-md p-4 h-fit">
      <PromptTemplates onSelect={applyTemplate} activeLabel={form.templateLabel} />

      <div>
        <label className={labelClass}>Prompt goal</label>
        <textarea
          className={`${inputClass} min-h-[88px] resize-y`}
          value={form.goal}
          onChange={(e) => updateForm({ goal: e.target.value })}
          placeholder="What should this prompt accomplish?"
        />
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <select
          className={selectClass}
          value={form.category}
          onChange={(e) => updateForm({ category: e.target.value })}
        >
          {PROMPT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Prompt type</label>
        <select
          className={selectClass}
          value={form.type}
          onChange={(e) => updateForm({ type: e.target.value })}
        >
          {PROMPT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <PromptModes mode={form.mode} onChange={(mode) => updateForm({ mode })} />

      <div>
        <label className={labelClass}>Extra instructions</label>
        <textarea
          className={`${inputClass} min-h-[72px] resize-y`}
          value={form.extraInstructions}
          onChange={(e) => updateForm({ extraInstructions: e.target.value })}
          placeholder="Tone, format, constraints…"
        />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-primary">
          <input
            type="checkbox"
            checked={enhanceEnabled}
            onChange={(e) => setEnhanceEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Enhance existing prompt
        </label>
        {enhanceEnabled && (
          <div className="mt-3 space-y-2">
            <textarea
              className={`${inputClass} min-h-[100px] resize-y font-mono text-xs`}
              value={existingPrompt}
              onChange={(e) => setExistingPrompt(e.target.value)}
              placeholder="Paste your current prompt…"
            />
            <button
              type="button"
              disabled={loading || atCap}
              onClick={onEnhance}
              className="w-full py-2.5 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-50 hover:opacity-90"
            >
              {atCap ? "Limit reached" : loading ? "Working…" : "Enhance prompt"}
            </button>
          </div>
        )}
      </div>

      {!enhanceEnabled && (
        <button
          type="button"
          disabled={loading || atCap}
          onClick={onGenerate}
          className="w-full py-2.5 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-50 hover:opacity-90"
        >
          {atCap ? "Limit reached" : loading ? "Generating…" : "Generate prompt"}
        </button>
      )}
    </aside>
  );
}
