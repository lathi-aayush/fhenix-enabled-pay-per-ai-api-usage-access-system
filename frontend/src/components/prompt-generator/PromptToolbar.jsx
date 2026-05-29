import React from "react";

export default function PromptToolbar({
  disabled,
  loading,
  onCopy,
  onRegenerate,
  onVariations,
  onImprove,
  onDownload,
  onAnalyze,
  onWorkflowToImage,
  analyzing,
  variant = "full",
}) {
  const btn =
    "text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-surface-variant bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40";

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <button type="button" className={btn} disabled={disabled} onClick={onCopy}>
        Copy
      </button>
      {variant === "full" && (
        <>
          <button type="button" className={btn} disabled={loading} onClick={onRegenerate}>
            Regenerate
          </button>
          <button type="button" className={btn} disabled={disabled || loading} onClick={onVariations}>
            Variations
          </button>
          <button type="button" className={btn} disabled={disabled || loading} onClick={onImprove}>
            Improve
          </button>
        </>
      )}
      <button type="button" className={btn} disabled={disabled} onClick={onDownload}>
        Download .md
      </button>
      <button type="button" className={btn} disabled={disabled || analyzing} onClick={onAnalyze}>
        {analyzing ? "Analyzing…" : "Analyze"}
      </button>
      {onWorkflowToImage && (
        <button
          type="button"
          className={`${btn} border-[#031634]/30 text-[#031634]`}
          disabled={disabled || loading}
          onClick={onWorkflowToImage}
        >
          Prompt → Image
        </button>
      )}
    </div>
  );
}
