import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../../api/client.js";
import { useCreativeWorkflow } from "../../components/creative-workflow/useCreativeWorkflow.js";

const labelClass = "text-xs font-semibold text-slate-600 block mb-1";
const inputClass =
  "w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#031634]/30";

function StepPill({ label, status }) {
  const colors =
    status === "done"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "active"
        ? "bg-[#031634] text-white border-[#031634]"
        : "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${colors}`}>
      {label}
    </span>
  );
}

function renderMarkdown(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    if (line.startsWith("## "))
      return (
        <h3 key={i} className="font-headline text-sm font-semibold text-primary mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
    return (
      <p key={i} className="text-sm text-slate-700 leading-relaxed mb-1">
        {line}
      </p>
    );
  });
}

export default function CreativeWorkflow() {
  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
  const promptLimit = usage?.monthlyPromptLimit;
  const promptsUsed = usage?.monthlyPromptsUsed ?? 0;
  const atCap = promptLimit != null && promptsUsed >= promptLimit;

  const wf = useCreativeWorkflow({ atCap });
  const isThumbnail = wf.form.workflowType === "prompt-to-thumbnail";
  const mainImage = wf.result?.image?.dataUrl || wf.result?.images?.main?.dataUrl;

  const step1Status = wf.loading && wf.activeStep === "prompt" ? "active" : wf.result ? "done" : "idle";
  const step2Status = wf.loading && wf.activeStep === "image" ? "active" : mainImage ? "done" : "idle";

  return (
    <div className="pt-6">
      <header className="mb-6">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-[#031634] text-3xl">linked_services</span>
          <div>
            <h1 className="font-headline text-2xl font-semibold text-primary">Creative Workflow</h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Automate Advanced Prompt Generator → Image Generator in one run. Optional YouTube thumbnail
              strategy in the middle.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {usage?.tier || "free"} plan · {promptsUsed}
              {promptLimit != null ? ` of ${promptLimit}` : ""} AI runs (1 per workflow)
            </p>
          </div>
        </div>
      </header>

      {atCap && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Studio AI quota reached.{" "}
          <Link to="/studio/plan" className="font-semibold underline text-[#031634]">
            Upgrade
          </Link>
        </div>
      )}

      {wf.error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex justify-between">
          <span>{wf.error}</span>
          <button type="button" className="text-xs underline" onClick={() => wf.setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <StepPill label="1 · Prompt Generator" status={step1Status} />
        {isThumbnail && <StepPill label="2 · Thumbnail strategy" status={wf.result ? "done" : step1Status === "done" ? "active" : "idle"} />}
        <StepPill
          label={isThumbnail ? "3 · Image render" : "2 · Image render"}
          status={step2Status}
        />
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <aside className="w-full xl:w-[340px] shrink-0 space-y-4 bg-white border border-surface-variant rounded-md p-4 sticky top-20">
          <div>
            <label className={labelClass}>Workflow</label>
            <select
              className={inputClass}
              value={wf.form.workflowType}
              onChange={(e) => wf.updateForm({ workflowType: e.target.value })}
            >
              {wf.workflowTypes.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {wf.workflowTypes.find((w) => w.id === wf.form.workflowType)?.desc}
            </p>
          </div>

          <div>
            <label className={labelClass}>{isThumbnail ? "Video title / goal" : "Goal"}</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={wf.form.goal}
              onChange={(e) => wf.updateForm({ goal: e.target.value })}
              placeholder={
                isThumbnail
                  ? "YouTube video title or topic…"
                  : "Describe the image you want (hero visual, product shot, etc.)…"
              }
            />
          </div>

          <div>
            <label className={labelClass}>Existing prompt (optional — skips step 1)</label>
            <textarea
              className={`${inputClass} min-h-[72px] font-mono text-xs`}
              value={wf.existingPrompt}
              onChange={(e) => wf.setExistingPrompt(e.target.value)}
              placeholder="Paste a prompt from Advanced Prompt Generator to go straight to image…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select
                className={inputClass}
                value={wf.form.category}
                onChange={(e) => wf.updateForm({ category: e.target.value })}
              >
                {wf.promptCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Mode</label>
              <select
                className={inputClass}
                value={wf.form.mode}
                onChange={(e) => wf.updateForm({ mode: e.target.value })}
              >
                {wf.promptModes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isThumbnail && (
            <div>
              <label className={labelClass}>Aspect ratio</label>
              <select
                className={inputClass}
                value={wf.form.aspectRatio}
                onChange={(e) => wf.updateForm({ aspectRatio: e.target.value })}
              >
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
          )}

          {isThumbnail && (
            <>
              <div>
                <label className={labelClass}>Thumbnail style</label>
                <select
                  className={inputClass}
                  value={wf.form.style}
                  onChange={(e) => wf.updateForm({ style: e.target.value })}
                >
                  {wf.thumbnailStyles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Emotion</label>
                  <select
                    className={inputClass}
                    value={wf.form.emotion}
                    onChange={(e) => wf.updateForm({ emotion: e.target.value })}
                  >
                    {wf.emotions.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Face</label>
                  <select
                    className={inputClass}
                    value={wf.form.faceExpression}
                    onChange={(e) => wf.updateForm({ faceExpression: e.target.value })}
                  >
                    {wf.faceOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wf.form.generateImage !== false}
              onChange={(e) => wf.updateForm({ generateImage: e.target.checked })}
              className="accent-[#031634]"
            />
            <span className="text-xs text-slate-600">Render image automatically</span>
          </label>

          <motion.button
            type="button"
            disabled={wf.loading || atCap}
            onClick={wf.runWorkflow}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-50"
          >
            {wf.loading ? "Running workflow…" : "Run automated workflow"}
          </motion.button>

          <p className="text-[10px] text-on-surface-variant text-center">
            Prefer visual pipelines? Use the{" "}
            <Link to="/studio/workflows/templates" className="underline text-[#031634]">
              Creative: Prompt → Image
            </Link>{" "}
            template in Workflow Studio.
          </p>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {wf.loading && !wf.result && (
            <div className="rounded-md border border-surface-variant p-10 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[#031634]/20 border-t-[#031634] animate-spin" />
              <p className="text-sm font-medium text-primary">
                {wf.activeStep === "image" ? "Rendering image…" : "Generating prompt…"}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">This may take up to a minute</p>
            </div>
          )}

          {!wf.loading && !wf.result && (
            <div className="rounded-md border border-dashed border-surface-variant p-12 text-center text-sm text-on-surface-variant">
              Set a goal and run the workflow to see the generated prompt and image here.
            </div>
          )}

          {mainImage && (
            <div className="bg-white border border-surface-variant rounded-md p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-primary">Generated image</h2>
                <button
                  type="button"
                  onClick={wf.downloadImage}
                  className="text-[11px] font-semibold px-2 py-1 rounded border border-surface-variant hover:bg-slate-50"
                >
                  Download
                </button>
              </div>
              <img src={mainImage} alt="Workflow result" className="w-full rounded-md aspect-video object-cover" />
              {wf.result?.imageWarning && (
                <p className="text-xs text-amber-700 mt-2">{wf.result.imageWarning}</p>
              )}
            </div>
          )}

          {wf.result?.prompt && (
            <div className="bg-white border border-surface-variant rounded-md p-4">
              <h2 className="text-sm font-semibold text-primary mb-3">Generated prompt</h2>
              <div className="max-h-[40vh] overflow-auto">{renderMarkdown(wf.result.prompt)}</div>
            </div>
          )}

          {isThumbnail && wf.result?.result?.thumbnailText?.mainHook && (
            <div className="bg-white border border-surface-variant rounded-md p-4">
              <h2 className="text-sm font-semibold text-primary mb-2">Thumbnail hook</h2>
              <p className="text-lg font-bold text-[#031634]">{wf.result.result.thumbnailText.mainHook}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
