import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export default function Published() {
  const { data, isLoading } = useQuery({
    queryKey: ["studio-published"],
    queryFn: async () => (await api.get("/api/studio/published")).data,
  });
  const posts = data?.posts ?? [];

  return (
    <div className="pt-6 max-w-4xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Published</h1>
      <p className="text-sm text-on-surface-variant mb-6">Live posts across connected platforms.</p>
      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}
      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p._id} className="bg-white border border-surface-variant rounded-md px-4 py-3 text-sm">
            <div className="font-semibold text-primary">{p.title}</div>
            {(p.publishedPlatforms || []).map((pp, i) => (
              <div key={i} className="text-xs text-on-surface-variant mt-1">
                {pp.platform}: {pp.url ? <a href={pp.url} className="text-secondary hover:underline" target="_blank" rel="noreferrer">{pp.url}</a> : "pending"}
              </div>
            ))}
          </li>
        ))}
      </ul>
      {!isLoading && posts.length === 0 && <p className="text-sm text-on-surface-variant">No published posts yet.</p>}
    </div>
  );
}
