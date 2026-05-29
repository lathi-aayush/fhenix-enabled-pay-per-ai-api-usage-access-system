import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import PromptInput from "../../components/prompt-generator/PromptInput.jsx";
import PromptAnalyzer from "../../components/prompt-generator/PromptAnalyzer.jsx";
import { PromptOutputWithToolbar } from "../../components/prompt-generator/PromptOutput.jsx";
import { usePromptGenerator } from "../../components/prompt-generator/usePromptGenerator.js";

export default function PromptGenerator() {
  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
  const promptLimit = usage?.monthlyPromptLimit;
  const promptsUsed = usage?.monthlyPromptsUsed ?? 0;
  const atCap = promptLimit != null && promptsUsed >= promptLimit;
  const quotaLabel =
    promptLimit != null ? `${promptsUsed} of ${promptLimit} prompts used` : `${promptsUsed} prompts used`;

  const pg = usePromptGenerator({ atCap });

  const handleRegenerate = () => {
    if (pg.enhanceEnabled) pg.runEnhance();
    else pg.runGenerate();
  };

  const handleRetry = () => {
    pg.setError(null);
    handleRegenerate();
  };

  const analyzeTarget = pg.enhanceEnabled ? pg.enhancedBlock : pg.output;

  return (
    <div className="pt-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <span className="material-symbols-outlined text-[#031634] text-3xl">auto_awesome</span>
          <div>
            <h1 className="font-headline text-2xl font-semibold text-primary">Advanced Prompt Generator</h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Craft, analyze, and refine high-quality prompts with Gemini — included in your Studio subscription.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {usage?.tier || "free"} plan · {quotaLabel}
            </p>
          </div>
        </div>
      </header>

      {atCap && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;ve reached this month&apos;s Prompt Generator limit on the {usage?.tier || "free"} plan.{" "}
          <Link to="/studio/plan" className="font-semibold text-[#031634] underline">
            Upgrade your plan
          </Link>{" "}
          to continue.
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <PromptInput
          form={pg.form}
          updateForm={pg.updateForm}
          applyTemplate={pg.applyTemplate}
          enhanceEnabled={pg.enhanceEnabled}
          setEnhanceEnabled={pg.setEnhanceEnabled}
          existingPrompt={pg.existingPrompt}
          setExistingPrompt={pg.setExistingPrompt}
          onGenerate={pg.runGenerate}
          onEnhance={pg.runEnhance}
          loading={pg.loading}
          atCap={atCap}
        />

        <div className="flex-1 min-w-0 w-full space-y-0">
          <PromptAnalyzer analysis={pg.analysis} analyzing={pg.analyzing} />

          {pg.enhanceEnabled && pg.existingPrompt.trim() ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <PromptOutputWithToolbar
                title="Original"
                toolbarVariant="readonly"
                output={pg.existingPrompt}
                streaming={false}
                loading={false}
                error={null}
                emptyHint="Paste a prompt in the sidebar to enhance."
                handlers={{
                  onCopy: () => pg.copyToClipboard(pg.existingPrompt),
                  onRegenerate: handleRegenerate,
                  onVariations: () => {},
                  onImprove: () => {},
                  onDownload: () => pg.downloadMarkdown(pg.existingPrompt, "original-prompt.md"),
                  onAnalyze: () => pg.runAnalyze(pg.existingPrompt),
                  onWorkflowToImage: pg.runPromptToImage,
                }}
                analyzing={pg.analyzing}
              />
              <PromptOutputWithToolbar
                title="Enhanced"
                output={pg.enhancedBlock}
                streaming={pg.streaming}
                loading={pg.loading}
                workflowLoading={pg.workflowLoading}
                error={pg.error}
                onRetry={handleRetry}
                emptyHint="Enhanced prompt will stream here."
                handlers={{
                  onCopy: () => pg.copyToClipboard(pg.enhancedBlock),
                  onRegenerate: handleRegenerate,
                  onVariations: () => pg.runVariations(),
                  onImprove: () => pg.runImprove(),
                  onDownload: () => pg.downloadMarkdown(pg.enhancedBlock, "enhanced-prompt.md"),
                  onAnalyze: () => pg.runAnalyze(pg.enhancedBlock),
                  onWorkflowToImage: pg.runPromptToImage,
                }}
                analyzing={pg.analyzing}
              />
            </div>
          ) : (
            <PromptOutputWithToolbar
              title="Generated prompt"
              output={pg.output}
              streaming={pg.streaming}
              loading={pg.loading}
              workflowLoading={pg.workflowLoading}
              error={pg.error}
              onRetry={handleRetry}
              emptyHint="Fill in a goal and click Generate prompt — or pick a quick template."
              handlers={{
                onCopy: () => pg.copyToClipboard(),
                onRegenerate: handleRegenerate,
                onVariations: pg.runVariations,
                onImprove: pg.runImprove,
                onDownload: () => pg.downloadMarkdown(),
                onAnalyze: () => pg.runAnalyze(analyzeTarget),
                onWorkflowToImage: pg.runPromptToImage,
              }}
              analyzing={pg.analyzing}
            />
          )}

          {(pg.workflowLoading || pg.workflowResult?.image?.dataUrl) && (
            <div className="mt-6 bg-white border border-surface-variant rounded-md p-4">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-primary">Workflow · Generated image</h2>
                <Link
                  to="/studio/creative-workflow"
                  className="text-[11px] font-semibold text-[#031634] underline"
                >
                  Open Creative Workflow
                </Link>
              </div>
              {pg.workflowLoading ? (
                <p className="text-sm animate-pulse text-on-surface-variant">Rendering image from prompt…</p>
              ) : (
                <img
                  src={pg.workflowResult.image.dataUrl}
                  alt="Generated from prompt"
                  className="w-full max-w-2xl rounded-md aspect-video object-cover"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
