import React from "react";
const queue = [
  { id: "job-201", project: "YouTube Shorts", state: "Queued", progress: 10, duration: "—" },
  { id: "job-198", project: "Podcast Clips", state: "Rendering", progress: 64, duration: "04:21" },
  { id: "job-186", project: "Blog Campaigns", state: "Completed", progress: 100, duration: "02:09" },
  { id: "job-170", project: "YouTube Shorts", state: "Failed", progress: 100, duration: "01:17" },
];

export default function StudioQueue() {
  return (
    <div className="pt-6 max-w-5xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Render Queue</h1>
      <p className="text-sm text-on-surface-variant mb-6">Track queued, rendering, completed, and failed jobs.</p>
      <div className="space-y-3">
        {queue.map((job) => (
          <div key={job.id} className="bg-white border border-surface-variant rounded-md p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <p className="font-semibold text-primary">
                {job.id} · {job.project}
              </p>
              <p className="text-on-surface-variant">
                {job.state} · {job.duration}
              </p>
            </div>
            <div className="mt-2 w-full h-2 rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-700 transition-all duration-200" style={{ width: `${job.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
