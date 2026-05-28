import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

export default function StudioHome() {
  const { data: projectsRes } = useQuery({
    queryKey: ["studio-projects"],
    queryFn: async () => (await api.get("/api/studio/projects")).data,
  });
  const { data: draftsRes } = useQuery({
    queryKey: ["studio-drafts"],
    queryFn: async () => (await api.get("/api/studio/drafts")).data,
  });
  const { data: platformRes } = useQuery({
    queryKey: ["studio-platforms"],
    queryFn: async () => (await api.get("/api/studio/platforms")).data,
  });
  const { data: calRes } = useQuery({
    queryKey: ["studio-calendar-week"],
    queryFn: async () => {
      const start = startOfWeek(new Date()).toISOString();
      const end = endOfWeek(new Date()).toISOString();
      return (await api.get("/api/studio/calendar", { params: { start, end } })).data;
    },
  });

  const projects = projectsRes?.projects ?? [];
  const drafts = draftsRes?.posts ?? [];
  const platforms = platformRes?.platforms ?? [];
  const scheduled = calRes?.posts ?? [];

  return (
    <div className="pt-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary">Studio Home</h1>
          <p className="text-sm text-on-surface-variant mt-1">Content workflows and publishing, separate from the API marketplace.</p>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              to="/studio/workflows"
              className="inline-flex flex-col items-center justify-center w-[100px] h-[88px] bg-white border border-surface-variant rounded-md text-center px-2 hover:border-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-slate-700 text-2xl">account_tree</span>
              <span className="text-[11px] font-semibold text-primary mt-1">Workflows</span>
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              to="/studio/blogging-agent"
              className="inline-flex flex-col items-center justify-center w-[100px] h-[88px] bg-white border border-surface-variant rounded-md text-center px-2 hover:border-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-slate-700 text-2xl">article</span>
              <span className="text-[11px] font-semibold text-primary mt-1">New blog</span>
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              to="/studio/projects"
              className="inline-flex flex-col items-center justify-center w-[100px] h-[88px] bg-white border border-surface-variant rounded-md text-center px-2 hover:border-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-slate-700 text-2xl">folder</span>
              <span className="text-[11px] font-semibold text-primary mt-1">New project</span>
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              to="/studio/calendar"
              className="inline-flex flex-col items-center justify-center w-[100px] h-[88px] bg-white border border-surface-variant rounded-md text-center px-2 hover:border-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-slate-700 text-2xl">event</span>
              <span className="text-[11px] font-semibold text-primary mt-1">Schedule</span>
            </Link>
          </motion.div>
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              to="/studio/clipcraft"
              className="inline-flex flex-col items-center justify-center w-[100px] h-[88px] bg-white border border-surface-variant rounded-md text-center px-2 hover:border-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-slate-700 text-2xl">movie_edit</span>
              <span className="text-[11px] font-semibold text-primary mt-1">ClipCraft</span>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primary">Active projects</h2>
          <Link to="/studio/projects" className="text-xs text-secondary hover:underline">
            View all
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {projects.slice(0, 5).map((p) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -4 }}
              className="min-w-[200px] shrink-0"
            >
              <Link
                to={`/studio/projects/${p._id}`}
                className="block bg-white border border-surface-variant rounded-md p-4 h-full hover:border-secondary transition-colors"
              >
                <div className="w-1 h-8 rounded-full mb-2" style={{ backgroundColor: p.color || "#031634" }} />
                <p className="font-semibold text-primary text-sm">{p.title}</p>
                <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{p.description || "—"}</p>
              </Link>
            </motion.div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-on-surface-variant">No projects yet. Create one to organize your blogs.</p>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary">Recent drafts</h2>
            <Link to="/studio/drafts" className="text-xs text-secondary hover:underline">
              All drafts
            </Link>
          </div>
          <ul className="space-y-2">
            {drafts.slice(0, 5).map((post) => (
              <li key={post._id} className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-primary">{post.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {post.projectId?.title ? `${post.projectId.title} · ` : ""}
                    {post.updatedAt ? new Date(post.updatedAt).toLocaleString() : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{post.status}</span>
                  <Link to="/studio/blogging-agent" state={{ postId: post._id }} className="text-xs text-secondary hover:underline">
                    Edit
                  </Link>
                </div>
              </li>
            ))}
            {drafts.length === 0 && <p className="text-sm text-on-surface-variant">No drafts yet.</p>}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary">Scheduled this week</h2>
            <Link to="/studio/calendar" className="text-xs text-secondary hover:underline">
              Calendar
            </Link>
          </div>
          <ul className="space-y-2">
            {scheduled.slice(0, 6).map((post) => (
              <li key={post._id} className="bg-white border border-surface-variant rounded-md px-4 py-2 text-sm">
                <span className="font-medium text-primary">{post.title}</span>
                <span className="text-on-surface-variant text-xs ml-2">
                  {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString() : ""}
                </span>
              </li>
            ))}
            {scheduled.length === 0 && <p className="text-sm text-on-surface-variant">Nothing scheduled this week.</p>}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-semibold text-primary mb-3">Platform health</h2>
        <div className="flex flex-wrap gap-3">
          {["medium", "linkedin", "devto", "hashnode", "wordpress"].map((id) => {
            const connected = platforms.some((p) => p.platform === id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 bg-white border border-surface-variant rounded-md px-3 py-2 text-xs font-medium capitalize"
              >
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                {id === "devto" ? "Dev.to" : id}
              </div>
            );
          })}
        </div>
        <Link to="/studio/platforms" className="inline-block text-xs text-secondary mt-3 hover:underline">
          Manage connections
        </Link>
      </section>

      <section className="mt-10 pt-6 border-t border-slate-200">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Legacy studio tools</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/studio/clipcraft" className="text-secondary hover:underline">
            ClipCraft (video clips)
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/studio/data-analyst" className="text-secondary hover:underline">
            Data analyst
          </Link>
        </div>
      </section>
    </div>
  );
}
