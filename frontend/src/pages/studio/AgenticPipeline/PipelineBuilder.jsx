import React, { useEffect, useRef } from "react";
import PipelineNode from "../../../components/agentic-pipeline/PipelineNode.jsx";
import PipelineCanvas from "../../../components/agentic-pipeline/PipelineCanvas.jsx";
import RunStatusBar from "../../../components/agentic-pipeline/RunStatusBar.jsx";
import OutputViewer from "../../../components/agentic-pipeline/OutputViewer.jsx";

const inputClass =
  "w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#031634]/30";

import { useStudioFeatures } from "../../../hooks/useStudioFeatures.js";
import { CREDIT_WEIGHTS, RUN_TYPE_LABELS } from "../../../constants/studioPlans.js";

const RUN_TYPE_OPTIONS = [
  { id: "agentic_text", price: "0.5 ETH" },
  { id: "agentic_images", price: "5.0 ETH" },
  { id: "agentic_video", price: "15.0 ETH", requiresVideo: true },
  { id: "agentic_full", price: "15.0 ETH", requiresVideo: true, requiresTts: true },
];

export default function PipelineBuilder({ pipeline }) {
  const { videoAllowed, ttsAllowed } = useStudioFeatures();
  const {
    inputText,
    setInputText,
    imageFile,
    setImageFile,
    isRunning,
    currentPhase,
    phaseLabel,
    result,
    error,
    setError,
    run,
    runType,
    setRunType,
    phases,
    chainNodes,
  } = pipeline;

  const resultRef = useRef(null);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-surface-variant rounded-md p-4">
        <PipelineCanvas currentPhase={currentPhase}>
          {chainNodes.map((node) => (
            <PipelineNode key={node.id} node={node} currentPhase={currentPhase} />
          ))}
        </PipelineCanvas>
      </div>

      <div className="bg-white border border-surface-variant rounded-md p-4 space-y-3">
        <textarea
          className={`${inputClass} min-h-[100px] resize-y`}
          placeholder="Describe what you want to create â€” e.g. a cinematic promo video for a fitness app"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isRunning}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-600">Run mode:</span>
          {RUN_TYPE_OPTIONS.map((opt) => {
            const locked =
              (opt.requiresVideo && !videoAllowed) || (opt.requiresTts && !ttsAllowed);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isRunning || locked}
                title={
                  locked
                    ? opt.requiresVideo
                      ? "Upgrade to Pro for video (Veo)"
                      : "Upgrade for TTS"
                    : `${opt.price} per execution`
                }
                onClick={() => setRunType(opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 ${
                  runType === opt.id
                    ? "border-[#031634] bg-[#031634] text-white"
                    : locked
                      ? "border-slate-200 text-slate-400 cursor-not-allowed"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {locked && (
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                )}
                {RUN_TYPE_LABELS[opt.id]?.split("(")[0].trim() || opt.id}
                <span className="opacity-70">({opt.price})</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-[#031634] cursor-pointer border border-dashed border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50">
            Attach image (optional)
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isRunning}
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>
          {imageFile && (
            <span className="text-xs text-slate-600 flex items-center gap-2">
              {imageFile.name}
              <button
                type="button"
                className="text-slate-400 hover:text-rose-600"
                onClick={() => setImageFile(null)}
              >
                âœ•
              </button>
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={isRunning || !inputText.trim()}
          onClick={run}
          className="px-6 py-2.5 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-50 hover:opacity-95"
        >
          {isRunning ? "Pipeline runningâ€¦" : "Run pipeline"}
        </button>
      </div>

      {isRunning && (
        <RunStatusBar phases={phases} currentPhase={currentPhase} phaseLabel={phaseLabel} />
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex justify-between">
          <span>{error}</span>
          <button type="button" className="text-xs underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {result && (
        <div
          ref={resultRef}
          className="rounded-xl border-2 border-emerald-400 bg-emerald-50/40 p-1 shadow-lg shadow-emerald-100"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-200 bg-emerald-100/80 rounded-t-lg">
            <span className="material-symbols-outlined text-emerald-700">check_circle</span>
            <p className="text-sm font-bold text-emerald-900">Pipeline complete â€” your outputs</p>
          </div>
          <OutputViewer run={result} />
        </div>
      )}
    </div>
  );
}
