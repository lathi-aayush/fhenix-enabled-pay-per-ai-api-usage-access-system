import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listClipJobs } from "../api/clipcraftApi.js";
import { CLIP_STATUS_LABELS } from "../constants/clipcraftPricing.js";

function mapState(status) {
  if (status === "ready") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Queued";
  if (status === "rendering" || status === "transcribing" || status === "analyzing" || status === "generating_copy") {
    return "Rendering";
  }
  return status;
}

export default function StudioQueue() {
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["clipcraft-jobs"],
    queryFn: listClipJobs,
    refetchInterval: 5000,
  });

  return (
    <div className="pt-6 max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Render Queue</h1>
          <p className="text-sm text-on-surface-variant">
            ClipCraft jobs from this server session. Restarting the API clears the in-memory queue.
          </p>
        </div>
        <Link
          to="/studio/clipcraft"
          className="text-sm font-semibold px-4 py-2 bg-[#031634] text-white rounded-md hover:opacity-90"
        >
          New clip job
        </Link>
      </header>

      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/studio/clipcraft?job=${encodeURIComponent(job.id)}`}
            className="block bg-white border border-surface-variant rounded-md p-4 hover:border-slate-300"
          >
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <p className="font-semibold text-primary truncate max-w-lg">{job.id}</p>
              <p className="text-on-surface-variant">{mapState(job.status)}</p>
            </div>
            <p className="text-xs text-slate-500 truncate mt-1">{job.url}</p>
            <div className="mt-2 w-full h-2 rounded bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#031634] transition-all duration-200"
                style={{ width: `${job.progressPercent ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {CLIP_STATUS_LABELS[job.status] || job.status} · {job.segments?.length || 0} segments
            </p>
          </Link>
        ))}
      </div>

      {!isLoading && jobs.length === 0 && (
        <p className="text-sm text-on-surface-variant">
          No jobs in queue.{" "}
          <Link to="/studio/clipcraft" className="text-secondary font-semibold hover:underline">
            Create one in ClipCraft
          </Link>
          .
        </p>
      )}

      <button type="button" onClick={() => refetch()} className="mt-4 text-xs text-secondary hover:underline">
        Refresh
      </button>
    </div>
  );
}
