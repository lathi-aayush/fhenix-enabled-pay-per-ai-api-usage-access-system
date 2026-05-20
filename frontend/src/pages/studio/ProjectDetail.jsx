import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";

export default function ProjectDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["studio-project", id],
    queryFn: async () => (await api.get(`/api/studio/projects/${id}`)).data,
    enabled: !!id,
  });

  const project = data?.project;
  const posts = data?.posts ?? [];

  if (isLoading) {
    return <p className="pt-6 text-sm animate-pulse text-on-surface-variant">Loading…</p>;
  }
  if (!project) {
    return <p className="pt-6 text-sm text-on-surface-variant">Project not found.</p>;
  }

  return (
    <div className="pt-6 max-w-4xl">
      <Link to="/studio/projects" className="text-xs text-secondary hover:underline mb-4 inline-block">
        ← Projects
      </Link>
      <header className="mb-8">
        <div className="w-1 h-12 rounded-full mb-2" style={{ backgroundColor: project.color || "#031634" }} />
        <h1 className="font-headline text-2xl font-semibold text-primary">{project.title}</h1>
        <p className="text-sm text-on-surface-variant mt-2">{project.description || "—"}</p>
        {project.brandVoice && (
          <p className="text-xs text-slate-500 mt-3">
            <span className="font-semibold">Voice:</span> {project.brandVoice}
          </p>
        )}
      </header>
      <section>
        <h2 className="font-semibold text-primary mb-3">Posts</h2>
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p._id} className="bg-white border border-surface-variant rounded-md px-4 py-3 flex justify-between gap-2 text-sm">
              <div>
                <span className="font-medium text-primary">{p.title}</span>
                <span className="text-xs text-on-surface-variant ml-2">{p.status}</span>
              </div>
              <Link to="/studio/blogging-agent" state={{ postId: p._id }} className="text-xs text-secondary shrink-0">
                Open
              </Link>
            </li>
          ))}
        </ul>
        {posts.length === 0 && <p className="text-sm text-on-surface-variant">No posts for this project yet.</p>}
      </section>
    </div>
  );
}
