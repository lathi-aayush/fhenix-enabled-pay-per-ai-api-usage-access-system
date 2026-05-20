import React from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export default function StudioCalendar() {
  const range = useMemo(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 2);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-calendar", range.start, range.end],
    queryFn: async () => (await api.get("/api/studio/calendar", { params: range })).data,
  });

  const posts = data?.posts ?? [];

  return (
    <div className="pt-6 max-w-4xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Calendar</h1>
      <p className="text-sm text-on-surface-variant mb-6">Scheduled posts in the wider date window around today.</p>
      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}
      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p._id} className="bg-white border border-surface-variant rounded-md px-4 py-3 text-sm">
            <div className="font-semibold text-primary">{p.title}</div>
            <div className="text-xs text-on-surface-variant mt-1">
              {p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : "—"} · {p.status}
            </div>
          </li>
        ))}
      </ul>
      {!isLoading && posts.length === 0 && <p className="text-sm text-on-surface-variant">No scheduled posts.</p>}
    </div>
  );
}
