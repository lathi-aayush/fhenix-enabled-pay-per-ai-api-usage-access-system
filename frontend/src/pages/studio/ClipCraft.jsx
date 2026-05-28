import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getClipCraftHealth,
  getClipJob,
  listClipJobs,
  submitClipJob,
  pollClipJob,
} from "../../api/clipcraftApi.js";
import { estimateClipCredits, CLIP_STATUS_LABELS } from "../../constants/clipcraftPricing.js";
import { saveRecentClipJob } from "../../utils/clipcraftHistory.js";

function statusColor(status) {
  if (status === "ready") return "bg-emerald-100 text-emerald-800";
  if (status === "failed") return "bg-rose-100 text-rose-800";
  if (status === "queued") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

function formatTs(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClipCraft() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [url, setUrl] = useState("");
  const [tier, setTier] = useState("standard");
  const [packCount, setPackCount] = useState(1);
  const [activeJob, setActiveJob] = useState(null);
  const [polling, setPolling] = useState(false);

  const { data: health } = useQuery({
    queryKey: ["clipcraft-health"],
    queryFn: getClipCraftHealth,
    refetchInterval: 30_000,
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["clipcraft-jobs"],
    queryFn: listClipJobs,
    refetchInterval: polling ? 2000 : false,
  });

  const estimatedCost = useMemo(() => estimateClipCredits(packCount, tier), [packCount, tier]);
  const disabled = health?.status === "disabled";

  const jobIdFromUrl = searchParams.get("job");
  useEffect(() => {
    if (!jobIdFromUrl) return;
    let cancelled = false;
    getClipJob(jobIdFromUrl)
      .then((job) => {
        if (!cancelled) setActiveJob(job);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [jobIdFromUrl]);

  const generateM = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      if (!trimmed) throw new Error("Paste a YouTube or Twitch URL");
      const idempotencyKey = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const submit = await submitClipJob({
        url: trimmed,
        tier,
        packCount: Number(packCount) || 1,
        idempotencyKey,
      });
      setActiveJob(submit.job);
      setPolling(true);
      const final = await pollClipJob(submit.job.id, {
        onUpdate: (j) => setActiveJob(j),
      });
      saveRecentClipJob({
        jobId: final.id,
        url: final.url,
        status: final.status,
        tier: final.tier,
      });
      return final;
    },
    onSuccess: (job) => {
      setActiveJob(job);
      queryClient.invalidateQueries({ queryKey: ["clipcraft-jobs"] });
      if (job.status === "ready") toast.success("Clips ready!");
      else if (job.status === "failed") toast.error(job.error || "Job failed");
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e.message;
      toast.error(msg);
    },
    onSettled: () => setPolling(false),
  });

  const copySegment = (seg) => {
    const text = [
      seg.hooks?.join("\n") || "",
      "",
      seg.caption || "",
      "",
      (seg.hashtags || []).join(" "),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  };

  return (
    <div className="pt-6 max-w-4xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">movie_edit</span>
            ClipCraft
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            Paste a long-form video URL. We pull a transcript, pick 30–60s highlight windows, and generate
            hooks, captions, and hashtags for Shorts / Reels / TikTok.
          </p>
        </div>
        {health && (
          <span
            className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
              health.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            {health.status || (health.ok ? "up" : "degraded")}
          </span>
        )}
      </header>

      {disabled && (
        <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
          ClipCraft is disabled on the server. Set <code className="text-xs">CLIPCRAFT_ENABLED=true</code> in{" "}
          backend <code className="text-xs">.env</code> and restart the API.
        </p>
      )}

      <div className="bg-white border border-surface-variant rounded-xl p-5 shadow-sm mb-8">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Video URL</label>
        <input
          className="w-full border border-surface-variant rounded-md px-3 py-2.5 text-sm"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={generateM.isPending || disabled}
        />

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Tier</label>
            <select
              className="w-full border border-surface-variant rounded-md px-3 py-2 text-sm mt-1"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={generateM.isPending || disabled}
            >
              <option value="standard">Standard hooks</option>
              <option value="viral">Viral-optimized (+0.2 / pack)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Clip packs</label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full border border-surface-variant rounded-md px-3 py-2 text-sm mt-1"
              value={packCount}
              onChange={(e) => setPackCount(Number(e.target.value))}
              disabled={generateM.isPending || disabled}
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
            1–20 clip packs per job · 10+ = bulk rate (12 credits). Mock mode uses a demo transcript until live providers are configured.
          </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Est. credits</label>
            <p className="text-lg font-semibold text-primary mt-2">{estimatedCost}</p>
          </div>
        </div>

        <button
          type="button"
          disabled={generateM.isPending || disabled || !url.trim()}
          onClick={() => generateM.mutate()}
          className="mt-5 w-full sm:w-auto px-6 py-2.5 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-40"
        >
          {generateM.isPending ? "Processing…" : "Generate clips"}
        </button>
      </div>

      {activeJob && (
        <section className="mb-8 bg-white border border-indigo-100 rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-primary text-sm">Current job</h2>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusColor(activeJob.status)}`}>
              {CLIP_STATUS_LABELS[activeJob.status] || activeJob.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate mb-2">{activeJob.url}</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-[#031634] transition-all duration-300"
              style={{ width: `${activeJob.progressPercent ?? 0}%` }}
            />
          </div>
          {activeJob.error && (
            <p className="text-xs text-rose-700 bg-rose-50 rounded px-2 py-1 mb-3">{activeJob.error}</p>
          )}
          {activeJob.segments?.length > 0 && (
            <div className="space-y-4">
              {activeJob.segments.map((seg) => (
                <article key={seg.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600 mb-2">
                    <span>
                      {formatTs(seg.startTs)} – {formatTs(seg.endTs)} · {Math.round(seg.duration)}s
                    </span>
                    <span>Score {(seg.engagementScore * 100).toFixed(0)}% · {seg.sentimentLabel}</span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Hooks</p>
                  <ul className="text-sm text-slate-800 list-disc list-inside mb-2">
                    {(seg.hooks || []).map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-slate-700 mb-2">{seg.caption}</p>
                  <p className="text-xs text-secondary">{(seg.hashtags || []).join(" ")}</p>
                  <button
                    type="button"
                    className="mt-3 text-[10px] font-semibold text-[#031634] hover:underline"
                    onClick={() => copySegment(seg)}
                  >
                    Copy block
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primary text-sm">Recent jobs (this session)</h2>
          <button type="button" className="text-xs text-secondary hover:underline" onClick={() => refetchJobs()}>
            Refresh
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No jobs yet — generate your first clip pack above.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="bg-white border border-surface-variant rounded-md px-4 py-3 text-sm flex flex-wrap justify-between gap-2 cursor-pointer hover:border-slate-300"
                onClick={() => {
                  setActiveJob(j);
                  setSearchParams({ job: j.id });
                }}
              >
                <span className="truncate max-w-md text-slate-700">{j.url}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusColor(j.status)}`}>
                  {CLIP_STATUS_LABELS[j.status] || j.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/studio/queue" className="inline-block mt-3 text-xs font-semibold text-secondary hover:underline">
          Open Render Queue →
        </Link>
      </section>
    </div>
  );
}
