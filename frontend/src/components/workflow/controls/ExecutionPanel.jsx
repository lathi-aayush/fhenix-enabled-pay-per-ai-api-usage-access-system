import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StructuredOutputView, NodeOutputPreview } from "../StructuredOutputView.jsx";
import AudioPlayerBlock from "../../shared/AudioPlayerBlock.jsx";
import { extractBlogResult } from "../../../utils/workflowBlog.js";
import { mediaSrc } from "../../../utils/mediaUrl.js";

export default function ExecutionPanel({
  run,
  isOpen,
  onClose,
  onRerun,
  onOpenBlog,
  liveLogs = [],
  nodeMeta = {},
}) {
  const logRef = useRef(null);
  const finalRef = useRef(null);
  const [expanded, setExpanded] = useState({ final: true });
  const [showSteps, setShowSteps] = useState(false);
  const [pulseComplete, setPulseComplete] = useState(false);

  const logs = [...(run?.logs || []), ...liveLogs];
  const saveIssue =
    run?.saveWarning ||
    logs.some((l) => /Save failed|Fatal:/i.test(l));
  const nodesAllDone =
    (run?.nodeResults?.length || 0) > 0 &&
    run.nodeResults.every((nr) => nr.status === "completed" || nr.status === "success");
  const isComplete =
    run?.status === "completed" || (nodesAllDone && Boolean(run?.structuredResult));
  const isFailed = run?.status === "failed";
  const isRunning = run?.status === "running" && !isComplete;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveLogs, run?.logs]);

  useEffect(() => {
    if (isComplete) {
      setExpanded((p) => ({ ...p, final: true }));
      setPulseComplete(true);
      const t = setTimeout(() => setPulseComplete(false), 2400);
      requestAnimationFrame(() => {
        finalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return () => clearTimeout(t);
    }
  }, [isComplete]);

  const nodeResults = run?.nodeResults || [];
  const outputNodeResult = nodeResults.find((nr) => nodeMeta[nr.nodeId]?.type === "output");
  const outputNodeDone =
    outputNodeResult?.status === "completed" || outputNodeResult?.status === "success";
  const stepResults = nodeResults.filter(
    (nr) => !["output", "blog"].includes(nodeMeta[nr.nodeId]?.type)
  );

  const imageStep = nodeResults.find((nr) => nodeMeta[nr.nodeId]?.type === "imageGen");
  let workflowImageUrl = null;
  if (imageStep?.output) {
    try {
      const parsed = JSON.parse(imageStep.output);
      workflowImageUrl = mediaSrc(parsed?.image) || null;
    } catch {
      /* ignore */
    }
  }

  const finalPayload = run?.structuredResult;

  const audioStep = nodeResults.find((nr) => nodeMeta[nr.nodeId]?.type === "agenticAudio");
  let workflowAudio = null;
  if (audioStep?.output) {
    try {
      const parsed = JSON.parse(audioStep.output);
      workflowAudio = parsed?.audio || null;
      if (!mediaSrc(workflowAudio) && typeof parsed?.content === "string") {
        workflowAudio = { mimeType: "audio/wav", url: parsed.content };
      }
    } catch {
      /* ignore */
    }
  }
  if (!mediaSrc(workflowAudio) && finalPayload?.final?.audio) {
    workflowAudio = finalPayload.final.audio;
  }
  if (!mediaSrc(workflowAudio) && finalPayload?.steps) {
    const stepAudio = [...finalPayload.steps].reverse().find((s) => mediaSrc(s.structured?.audio));
    if (stepAudio?.structured?.audio) workflowAudio = stepAudio.structured.audio;
  }
  const finalFallback = outputNodeResult?.output || nodeResults[nodeResults.length - 1]?.output;
  const blogResult = extractBlogResult(run);
  const hasFinal = Boolean(finalPayload || finalFallback);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 420 }}
          animate={{ x: 0 }}
          exit={{ x: 420 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-[min(440px,42vw)] shrink-0 bg-white border-2 border-[#031634]/10 rounded-xl flex flex-col h-[calc(100vh-12rem)] min-h-[480px] shadow-lg overflow-hidden"
        >
          <div
            className={`p-4 border-b flex items-center justify-between ${
              isComplete
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-600"
                : isFailed
                  ? "bg-rose-50 border-rose-200"
                  : "bg-slate-50 border-surface-variant"
            }`}
          >
            <div>
              <h3 className={`text-sm font-bold ${isComplete ? "text-white" : "text-primary"}`}>
                Execution
              </h3>
              <p
                className={`text-[10px] uppercase font-bold tracking-wide ${
                  isComplete ? "text-emerald-100" : "text-on-surface-variant"
                }`}
              >
                {isRunning && "Running…"}
                {isComplete && "✓ Complete"}
                {isFailed && "Failed"}
                {!run?.status && "Waiting…"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`p-1 rounded ${isComplete ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-primary"}`}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {run && (
            <div className="p-3 text-[11px] text-on-surface-variant grid grid-cols-3 gap-2 border-b border-surface-variant bg-slate-50/80">
              <div>
                <p className="text-[9px] uppercase text-slate-400">Credits</p>
                <p className="font-mono font-semibold text-secondary">
                  {(run.totalCreditsDeducted ?? 0).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-slate-400">Tokens</p>
                <p className="font-mono font-semibold text-primary">{run.totalTokensUsed ?? 0}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-slate-400">Runtime</p>
                <p className="font-mono font-semibold text-primary">
                  {run.runtimeMs ? `${(run.runtimeMs / 1000).toFixed(1)}s` : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {saveIssue && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                Run finished but saving to the database had an issue (audio was too large). Results
                below are still valid — restart the backend and run again for a clean save.
              </div>
            )}

            {isComplete && hasFinal && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border-2 p-4 ${
                  pulseComplete
                    ? "border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-200/60 animate-pulse"
                    : "border-emerald-300 bg-emerald-50/90"
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="material-symbols-outlined text-2xl text-emerald-600">
                    celebration
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Workflow finished</h4>
                    <p className="text-[11px] text-emerald-800">
                      {outputNodeDone
                        ? "Output node compiled your final result below."
                        : "Final summary is ready below."}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {nodeResults.length === 0 && !run && (
              <p className="text-xs text-slate-500">Run the workflow to see structured results here.</p>
            )}

            {blogResult && (
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-3 space-y-2">
                <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">article</span>
                  Blog post ready
                </h4>
                <p className="text-sm font-semibold text-primary">{blogResult.title}</p>
                <p className="text-[10px] text-indigo-800">
                  {blogResult.wordCount} words · {blogResult.readingTime || "—"} min read ·{" "}
                  <span className="uppercase font-bold">{blogResult.status}</span>
                </p>
                {(blogResult.queuedPlatforms?.length > 0 ||
                  blogResult.publishedPlatforms?.length > 0) && (
                  <p className="text-[10px] text-indigo-700">
                    Published:{" "}
                    {(blogResult.publishedPlatforms || blogResult.queuedPlatforms || [])
                      .map((p) => (typeof p === "string" ? p : p.platform))
                      .join(", ") || blogResult.status}
                  </p>
                )}
                {blogResult.scheduled && blogResult.scheduledFor && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 rounded px-2 py-1">
                    Scheduled: {new Date(blogResult.scheduledFor).toLocaleString()}
                    {blogResult.scheduledPlatforms?.length
                      ? ` → ${blogResult.scheduledPlatforms.join(", ")}`
                      : ""}
                  </p>
                )}
                {blogResult.scheduleMessage && (
                  <p className="text-[10px] text-indigo-700">{blogResult.scheduleMessage}</p>
                )}
                {blogResult.publishError && (
                  <p className="text-[10px] text-rose-700 bg-rose-50 rounded px-2 py-1">
                    {blogResult.publishError}
                  </p>
                )}
                {blogResult.status === "scheduled" && (
                  <Link
                    to="/studio/calendar"
                    className="block text-center text-[10px] font-semibold text-secondary hover:underline"
                  >
                    View on Calendar →
                  </Link>
                )}
                {blogResult.status === "published" && (
                  <Link
                    to="/studio/published"
                    className="block text-center text-[10px] font-semibold text-secondary hover:underline"
                  >
                    View on Published page →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => onOpenBlog?.(blogResult.blogPostId)}
                  className="w-full py-2 text-xs font-bold rounded-md bg-[#031634] text-white hover:opacity-90"
                >
                  Open in Blogging Agent →
                </button>
              </div>
            )}

            {mediaSrc(workflowAudio) && (
              <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-3">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-base">mic</span>
                  Voiceover audio
                </h4>
                <AudioPlayerBlock audio={workflowAudio} className="border-0 p-0" />
              </div>
            )}

            {workflowImageUrl && (
              <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/50 p-3">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-base">image</span>
                  Generated image
                </h4>
                <img
                  src={workflowImageUrl}
                  alt="Workflow generated"
                  className="w-full rounded-md aspect-video object-cover border border-slate-200"
                />
                <a
                  href={workflowImageUrl}
                  download="workflow-image.png"
                  className="block text-center text-[10px] font-semibold text-[#031634] underline mt-2"
                >
                  Download PNG
                </a>
              </div>
            )}

            {hasFinal && (
              <div
                ref={finalRef}
                className={`rounded-xl border-2 p-4 ${
                  isComplete
                    ? "border-[#031634] bg-white shadow-md"
                    : "border-[#031634]/15 bg-gradient-to-b from-slate-50 to-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-lg text-emerald-600">
                      task_alt
                    </span>
                    {blogResult ? "Research summary" : "Final output"}
                  </h4>
                  <button
                    type="button"
                    className="text-[10px] text-secondary font-semibold underline"
                    onClick={() => setExpanded((p) => ({ ...p, final: !p.final }))}
                  >
                    {expanded.final ? "Collapse" : "Expand"}
                  </button>
                </div>
                {expanded.final && (
                  <div className="max-h-[min(52vh,520px)] overflow-y-auto pr-1 text-sm">
                    <StructuredOutputView
                      structuredResult={finalPayload}
                      fallbackText={finalFallback}
                    />
                  </div>
                )}
              </div>
            )}

            {isComplete && !hasFinal && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Run finished but no structured output was produced. Add an Output node connected to
                your last step, or check step-by-step results below.
              </p>
            )}

            {stepResults.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSteps((s) => !s)}
                  className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showSteps ? "expand_less" : "expand_more"}
                  </span>
                  Step-by-step ({stepResults.length})
                </button>
                {showSteps && (
                  <div className="space-y-2">
                    {stepResults.map((nr) => {
                      const meta = nodeMeta[nr.nodeId] || {};
                      return (
                        <NodeOutputPreview
                          key={nr.nodeId}
                          label={meta.label || nr.nodeId}
                          type={meta.type || "node"}
                          status={nr.status}
                          output={nr.output}
                          expanded={expanded[nr.nodeId]}
                          onToggle={() =>
                            setExpanded((p) => ({ ...p, [nr.nodeId]: !p[nr.nodeId] }))
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {nodeResults.some((nr) => nr.error) && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-700">
                {nodeResults
                  .filter((nr) => nr.error)
                  .map((nr) => (
                    <p key={nr.nodeId}>
                      {nodeMeta[nr.nodeId]?.label || nr.nodeId}: {nr.error}
                    </p>
                  ))}
              </div>
            )}
          </div>

          <pre
            ref={logRef}
            className="h-20 overflow-y-auto p-3 text-[9px] font-mono text-slate-500 bg-slate-50 border-t border-surface-variant"
          >
            {logs.join("\n") || "Logs will appear here…"}
          </pre>

          <div className="p-3 border-t border-surface-variant">
            <button
              type="button"
              onClick={onRerun}
              disabled={isRunning}
              className="w-full py-2.5 text-xs font-bold rounded-md bg-[#031634] text-white disabled:opacity-40"
            >
              Re-run
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
