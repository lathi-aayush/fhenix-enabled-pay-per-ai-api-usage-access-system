import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../../api/client.js";
import ThumbnailInputPanel from "../../components/viral-thumbnail/ThumbnailInputPanel.jsx";
import ThumbnailResults from "../../components/viral-thumbnail/ThumbnailResults.jsx";
import HistorySidebar from "../../components/viral-thumbnail/HistorySidebar.jsx";
import { useViralThumbnail } from "../../components/viral-thumbnail/useViralThumbnail.js";

export default function ViralThumbnailAI() {
  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
  const promptLimit = usage?.monthlyPromptLimit;
  const promptsUsed = usage?.monthlyPromptsUsed ?? 0;
  const atCap = promptLimit != null && promptsUsed >= promptLimit;
  const quotaLabel =
    promptLimit != null ? `${promptsUsed} of ${promptLimit} AI tools used` : `${promptsUsed} generations`;

  const vt = useViralThumbnail({ atCap });

  return (
    <div className="pt-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-[#031634] text-3xl">thumbnail_bar</span>
            <div>
              <h1 className="font-headline text-2xl font-semibold text-primary">Viral Thumbnail AI</h1>
              <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
                AI thumbnail strategist — generates a 16:9 preview image plus concepts, hooks, CTR analysis, and
                variation renders powered by Gemini.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {usage?.tier || "free"} plan · {quotaLabel} (shared with Prompt Generator)
              </p>
            </div>
          </div>
          {vt.result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2"
            >
              <button
                type="button"
                onClick={vt.copyAll}
                className="text-[11px] font-semibold px-3 py-2 rounded-md border border-surface-variant bg-white hover:bg-slate-50"
              >
                Copy all
              </button>
              <button
                type="button"
                onClick={vt.saveResult}
                className="text-[11px] font-semibold px-3 py-2 rounded-md border border-surface-variant bg-white hover:bg-slate-50"
              >
                Save result
              </button>
              {vt.result?.images?.main?.dataUrl && (
                <button
                  type="button"
                  onClick={vt.downloadMainImage}
                  className="text-[11px] font-semibold px-3 py-2 rounded-md border border-surface-variant bg-white hover:bg-slate-50"
                >
                  Download image
                </button>
              )}
              <Link
                to={`/studio/creative-workflow?type=thumbnail&goal=${encodeURIComponent(vt.form.videoTitle || "")}`}
                className="text-[11px] font-semibold px-3 py-2 rounded-md border border-surface-variant bg-white hover:bg-slate-50"
              >
                Creative Workflow
              </Link>
              <button
                type="button"
                onClick={vt.exportPrompt}
                className="text-[11px] font-semibold px-3 py-2 rounded-md border border-surface-variant bg-white hover:bg-slate-50"
              >
                Export prompt
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {atCap && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Studio AI quota reached.{" "}
          <Link to="/studio/plan" className="font-semibold text-[#031634] underline">
            Upgrade your plan
          </Link>{" "}
          to generate more thumbnails.
        </div>
      )}

      {vt.error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex justify-between gap-2">
          <span>{vt.error}</span>
          <button type="button" className="underline text-xs" onClick={() => vt.setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <div className="w-full xl:w-[320px] shrink-0 space-y-4">
          <ThumbnailInputPanel
            form={vt.form}
            updateForm={vt.updateForm}
            onGenerate={vt.runGenerate}
            onRunWorkflow={vt.runAutomatedWorkflow}
            loading={vt.loading}
            workflowLoading={vt.workflowLoading}
            atCap={atCap}
            status={vt.status}
          />
          <HistorySidebar history={vt.history} onSelect={vt.selectHistory} onClear={vt.clearHistory} />
        </div>

        <motion.div
          className="flex-1 min-w-0 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ThumbnailResults
            result={vt.result}
            loading={vt.loading}
            imageLoading={vt.imageLoading}
            onRegenerateMainImage={vt.runRegenerateMainImage}
            onDownloadMainImage={vt.downloadMainImage}
            onRegenerateVariations={vt.runRegenerateVariations}
            variationsLoading={vt.variationsLoading}
          />
        </motion.div>
      </div>
    </div>
  );
}
