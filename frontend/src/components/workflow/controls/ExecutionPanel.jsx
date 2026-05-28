import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StructuredOutputView, NodeOutputPreview } from "../StructuredOutputView.jsx";
import { extractBlogResult } from "../../../utils/workflowBlog.js";

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
  const [expanded, setExpanded] = useState({ final: true });
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveLogs, run?.logs]);

  useEffect(() => {
    if (run?.status === "completed") setExpanded((p) => ({ ...p, final: true }));
  }, [run?.status]);

  const logs = [...(run?.logs || []), ...liveLogs];
  const nodeResults = run?.nodeResults || [];
  const outputNodeResult = nodeResults.find((nr) => nodeMeta[nr.nodeId]?.type === "output");
  const stepResults = nodeResults.filter(
    (nr) => !["output", "blog"].includes(nodeMeta[nr.nodeId]?.type)
  );

  const finalPayload = run?.structuredResult;
  const finalFallback = outputNodeResult?.output || nodeResults[nodeResults.length - 1]?.output;
  const blogResult = extractBlogResult(run);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-[380px] shrink-0 bg-white border border-surface-variant rounded-lg flex flex-col h-[calc(100vh-12rem)] min-h-[480px] shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-surface-variant flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold text-primary">Execution</h3>
              <p className="text-[10px] text-on-surface-variant">{run?.status || "Waiting…"}</p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-primary p-1">
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
                  {run.runtimeMs ? `${run.runtimeMs}ms` : "—"}
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                {(blogResult.queuedPlatforms?.length > 0 || blogResult.publishedPlatforms?.length > 0) && (
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
                  <p className="text-[10px] text-rose-700 bg-rose-50 rounded px-2 py-1">{blogResult.publishError}</p>
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

            {(finalPayload || finalFallback) && (
              <div className="rounded-xl border-2 border-[#031634]/15 bg-gradient-to-b from-slate-50 to-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">summarize</span>
                    {blogResult ? "Research summary" : "Final output"}
                  </h4>
                  <button
                    type="button"
                    className="text-[10px] text-secondary font-semibold"
                    onClick={() => setExpanded((p) => ({ ...p, final: !p.final }))}
                  >
                    {expanded.final ? "Collapse" : "Expand"}
                  </button>
                </div>
                {expanded.final && (
                  <StructuredOutputView
                    structuredResult={finalPayload}
                    fallbackText={finalFallback}
                  />
                )}
              </div>
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
            className="h-24 overflow-y-auto p-3 text-[9px] font-mono text-slate-500 bg-slate-50 border-t border-surface-variant"
          >
            {logs.join("\n") || "Logs will appear here…"}
          </pre>

          <div className="p-3 border-t border-surface-variant">
            <button
              type="button"
              onClick={onRerun}
              disabled={run?.status === "running"}
              className="w-full py-2 text-xs font-bold rounded-md bg-[#031634] text-white disabled:opacity-40"
            >
              Re-run
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
