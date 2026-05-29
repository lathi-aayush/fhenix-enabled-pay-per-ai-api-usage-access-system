import React from "react";
import { motion } from "framer-motion";
import { THUMBNAIL_STYLES, EMOTIONS, PLATFORMS, FACE_OPTIONS } from "./constants.js";

const labelClass = "text-xs font-semibold text-slate-600 block mb-1";
const inputClass =
  "w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#031634]/30";
const selectClass = inputClass;

export default function ThumbnailInputPanel({
  form,
  updateForm,
  onGenerate,
  onRunWorkflow,
  loading,
  workflowLoading,
  atCap,
  status,
}) {
  const btnLabel =
    status === "generating" || loading
      ? form.generateImages !== false
        ? "Generating thumbnail…"
        : "Generating strategy…"
      : atCap
        ? "Limit reached"
        : form.generateImages !== false
          ? "Generate thumbnail + strategy"
          : "Generate strategy only";

  return (
    <aside className="w-full xl:w-[320px] shrink-0 space-y-4 bg-white border border-surface-variant rounded-md p-4 h-fit sticky top-20">
      <div>
        <label className={labelClass}>Video title</label>
        <textarea
          className={`${inputClass} min-h-[88px] resize-y`}
          value={form.videoTitle}
          onChange={(e) => updateForm({ videoTitle: e.target.value })}
          placeholder="Enter your YouTube video title…"
        />
      </div>

      <div>
        <label className={labelClass}>Thumbnail style</label>
        <select className={selectClass} value={form.style} onChange={(e) => updateForm({ style: e.target.value })}>
          {THUMBNAIL_STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Emotion</label>
        <select className={selectClass} value={form.emotion} onChange={(e) => updateForm({ emotion: e.target.value })}>
          {EMOTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Platform</label>
        <select
          className={selectClass}
          value={form.platform}
          onChange={(e) => updateForm({ platform: e.target.value })}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Color theme</label>
        <input
          className={inputClass}
          value={form.colorTheme}
          onChange={(e) => updateForm({ colorTheme: e.target.value })}
          placeholder="Neon blue, red contrast, dark cinematic…"
        />
      </div>

      <div>
        <label className={labelClass}>Thumbnail text (optional)</label>
        <input
          className={inputClass}
          value={form.thumbnailText}
          onChange={(e) => updateForm({ thumbnailText: e.target.value })}
          placeholder="Custom hook text on thumbnail"
        />
      </div>

      <div>
        <label className={labelClass}>Face in thumbnail</label>
        <div className="flex gap-2">
          {FACE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => updateForm({ faceExpression: opt })}
              className={`flex-1 py-2 text-xs font-semibold rounded-md border transition-colors ${
                form.faceExpression === opt
                  ? "border-[#031634] bg-slate-100 text-primary"
                  : "border-surface-variant text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Viral intensity · {form.viralIntensity}/10
        </label>
        <p className="text-[10px] text-on-surface-variant mb-2">How aggressive should the CTR strategy be?</p>
        <input
          type="range"
          min={1}
          max={10}
          value={form.viralIntensity}
          onChange={(e) => updateForm({ viralIntensity: Number(e.target.value) })}
          className="w-full accent-[#031634]"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.generateImages !== false}
          onChange={(e) => updateForm({ generateImages: e.target.checked })}
          className="rounded border-slate-300 accent-[#031634]"
        />
        <span className="text-xs text-slate-600">Generate thumbnail image (16:9)</span>
      </label>

      <motion.button
        type="button"
        disabled={loading || workflowLoading || atCap}
        onClick={onGenerate}
        whileHover={{ scale: loading || atCap ? 1 : 1.02 }}
        whileTap={{ scale: loading || atCap ? 1 : 0.98 }}
        className="w-full py-3 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-50 shadow-md hover:opacity-95 transition-opacity"
      >
        {btnLabel}
      </motion.button>

      {onRunWorkflow && (
        <button
          type="button"
          disabled={loading || workflowLoading || atCap}
          onClick={onRunWorkflow}
          className="w-full py-2.5 border border-[#031634] text-[#031634] text-sm font-semibold rounded-md disabled:opacity-50 hover:bg-slate-50"
        >
          {workflowLoading ? "Running workflow…" : "Automated: Prompt → Thumbnail"}
        </button>
      )}
    </aside>
  );
}
