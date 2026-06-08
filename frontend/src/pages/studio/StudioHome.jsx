import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";
import { WORKFLOW_API } from "../../api/workflowApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWalletAction } from "../../hooks/useWalletAction.js";
import GuestConnectBanner from "../../components/GuestConnectBanner.jsx";
const PROJECT_COLORS = ["#006b5b", "#0e7490", "#4f46e5", "#7c3aed", "#b45309", "#be185d", "#031634"];

const QUICK_ACTIONS = [
  {
    to: "/studio/workflows",
    icon: "account_tree",
    label: "Workflows",
    description: "Run an AI pipeline",
    iconBg: "bg-indigo-100 text-indigo-700",
  },
  {
    to: "/studio/blogging-agent",
    icon: "article",
    label: "New Blog",
    description: "Start a post from scratch",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  {
    to: "/studio/projects",
    icon: "folder",
    label: "New Project",
    description: "Organize your content",
    iconBg: "bg-violet-100 text-violet-700",
  },
  {
    to: "/studio/calendar",
    icon: "event",
    label: "Schedule",
    description: "Plan your publishing",
    iconBg: "bg-sky-100 text-sky-700",
  },
  {
    to: "/studio/clipcraft",
    icon: "movie_edit",
    label: "ClipCraft",
    description: "Create video clips",
    iconBg: "bg-amber-100 text-amber-700",
  },
];

const PLATFORM_ICONS = {
  medium: "article",
  linkedin: "work",
  devto: "code",
  hashnode: "rss_feed",
  wordpress: "language",
};

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

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function projectColor(title, stored) {
  if (stored) return stored;
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function formatEditedAgo(date) {
  if (!date) return "Edited recently";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${days} days ago`;
}

function isProjectActive(updatedAt) {
  if (!updatedAt) return false;
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

function isWeakTitle(title) {
  const t = (title || "").trim();
  if (!t) return true;
  if (t.length <= 4) return true;
  if (t.split(/\s+/).length === 1 && t.length < 12) return true;
  return false;
}

function deriveTitleFromContent(content) {
  const raw = (content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const heading = raw.match(/^#{1,3}\s+(.+?)(?:\n|$)/m);
  if (heading?.[1]) return heading[1].slice(0, 80);
  const sentence = raw.match(/[A-Za-z][^.!?]{15,}[.!?]/);
  if (sentence?.[0]) return sentence[0].slice(0, 80);
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
}

function formatRelativeSchedule(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = d - now;
  if (diffMs < 0) return d.toLocaleString();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `In ${diffMins} minute${diffMins === 1 ? "" : "s"}`;
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) return `In ${Math.round(diffH)} hour${Math.round(diffH) === 1 ? "" : "s"}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function QuickActionCard({ action }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.15 }} className="shrink-0">
      <Link
        to={action.to}
        className="flex flex-col w-[148px] h-[124px] bg-white border border-surface-variant rounded-lg p-3 hover:border-secondary/40 hover:shadow-sm transition-all"
      >
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-lg ${action.iconBg} mb-2`}
        >
          <span className="material-symbols-outlined text-[20px]">{action.icon}</span>
        </span>
        <span className="text-sm font-semibold text-primary leading-tight">{action.label}</span>
        <span className="text-[11px] text-slate-500 mt-1 leading-snug">{action.description}</span>
      </Link>
    </motion.div>
  );
}

function DraftRow({ post, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const autoGenerated = isWeakTitle(post.title);
  const displayTitle = autoGenerated ? deriveTitleFromContent(post.content) || post.title || "Untitled draft" : post.title;

  return (
    <li
      className="group bg-white border border-surface-variant rounded-lg px-4 py-3 flex items-center justify-between gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold text-primary truncate ${autoGenerated ? "italic" : ""}`}
          title={displayTitle}
        >
          {displayTitle}
        </p>
        <p className="text-xs text-on-surface-variant mt-0.5 truncate">
          {post.projectId?.title ? `${post.projectId.title} · ` : ""}
          {post.updatedAt ? new Date(post.updatedAt).toLocaleString() : ""}
        </p>
        {autoGenerated && hovered && (
          <Link
            to="/studio/blogging-agent"
            state={{ postId: post._id }}
            className="text-[10px] text-secondary hover:underline mt-0.5 inline-block"
          >
            Rename
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          Draft
        </span>
        <Link
          to="/studio/blogging-agent"
          state={{ postId: post._id }}
          className="text-xs font-semibold px-3 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(post._id)}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1"
          title="Delete draft"
          aria-label="Delete draft"
        >
          🗑
        </button>
      </div>
    </li>
  );
}

export default function StudioHome() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { runWithWallet } = useWalletAction();
  const queryClient = useQueryClient();
  const authEnabled = Boolean(user);

  const { data: projectsRes } = useQuery({
    queryKey: ["studio-projects"],
    queryFn: async () => (await api.get("/api/studio/projects")).data,
    enabled: authEnabled,
  });
  const { data: draftsRes } = useQuery({
    queryKey: ["studio-drafts"],
    queryFn: async () => (await api.get("/api/studio/drafts")).data,
    enabled: authEnabled,
  });
  const { data: publishedRes } = useQuery({
    queryKey: ["studio-published"],
    queryFn: async () => (await api.get("/api/studio/published")).data,
    enabled: authEnabled,
  });
  const { data: calRes } = useQuery({
    queryKey: ["studio-calendar-week"],
    queryFn: async () => {
      const start = startOfWeek(new Date()).toISOString();
      const end = endOfWeek(new Date()).toISOString();
      return (await api.get("/api/studio/calendar", { params: { start, end } })).data;
    },
    enabled: authEnabled,
  });
  const { data: workflowsRes } = useQuery({
    queryKey: ["workflows", "home"],
    queryFn: async () => (await api.get(WORKFLOW_API.list, { params: { limit: 10 } })).data,
    enabled: authEnabled,
  });
  const { data: templatesRes, isLoading: templatesLoading } = useQuery({
    queryKey: ["workflow-templates", "home"],
    queryFn: async () => (await api.get(WORKFLOW_API.templates)).data,
  });

  const deleteDraftM = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/api/studio/blog/${id}`);
    },
    onSuccess: () => {
      toast.success("Draft deleted");
      queryClient.invalidateQueries({ queryKey: ["studio-drafts"] });
    },
    onError: (e) => toast.error(e?.response?.data?.error || "Failed to delete draft"),
  });

  const projects = projectsRes?.projects ?? [];
  const drafts = draftsRes?.posts ?? [];
  const published = publishedRes?.posts ?? [];
  const scheduled = calRes?.posts ?? [];
  const workflows = workflowsRes?.data?.items ?? [];
  const featuredTemplates = (templatesRes?.data ?? []).slice(0, 6);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || "Creator";
  const lastProject = projects[0];
  const lastWorkflow = workflows[0];

  const greetingLine = useMemo(() => {
    if (drafts.length > 0) {
      return `${timeGreeting()}, ${firstName} — you have ${drafts.length} draft${drafts.length === 1 ? "" : "s"} ready to publish.`;
    }
    if (lastWorkflow?.name) {
      return `Welcome back, ${firstName} — continue working on ${lastWorkflow.name}.`;
    }
    if (lastProject?.title) {
      return `Welcome back, ${firstName} — your last session: ${lastProject.title}.`;
    }
    return `${timeGreeting()}, ${firstName} — your workspace is ready.`;
  }, [drafts.length, firstName, lastProject?.title, lastWorkflow?.name]);

  const projectStats = useMemo(() => {
    const map = {};
    const bump = (id, field) => {
      if (!id) return;
      const key = String(id);
      map[key] = map[key] || { drafts: 0, published: 0 };
      map[key][field]++;
    };
    drafts.forEach((d) => bump(d.projectId?._id || d.projectId, "drafts"));
    published.forEach((p) => bump(p.projectId?._id || p.projectId, "published"));
    return map;
  }, [drafts, published]);

  const totalDrafts = drafts.length;
  const totalPublished = published.length;

  return (
    <div className="pt-4 pb-8">
      {!isAuthenticated && (
        <GuestConnectBanner
          message="Browse Studio tools freely. Connect Pera Wallet to save projects, generate content, and publish."
          className="mb-6"
        />
      )}
      {/* Top row: greeting + quick actions | balance + scheduled */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] pb-8 border-b border-slate-200">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary leading-snug">
            {isAuthenticated ? greetingLine : `${timeGreeting()} — explore AI Studio tools for creators.`}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {scheduled.length > 0
              ? `${scheduled.length} post${scheduled.length === 1 ? "" : "s"} scheduled this week.`
              : "Pick a quick action to get started."}
          </p>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Quick actions</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.to} action={action} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-primary">📅 Scheduled This Week</h2>
              <Link to="/studio/calendar" className="text-xs font-medium text-secondary hover:underline">
                Manage schedule
              </Link>
            </div>
            {scheduled.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {scheduled.slice(0, 6).map((post) => {
                  const platform = post.scheduledPlatforms?.[0] || post.publishedPlatforms?.[0]?.platform || "medium";
                  return (
                    <li key={post._id} className="px-4 py-3 flex items-start gap-3">
                      <span className="material-symbols-outlined text-slate-500 text-[18px] mt-0.5 shrink-0">
                        {PLATFORM_ICONS[platform] || "event"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate" title={post.title}>
                          {post.title || "Untitled"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{formatRelativeSchedule(post.scheduledFor)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-slate-300 text-3xl">calendar_month</span>
                <p className="text-sm text-slate-500 mt-2">Nothing scheduled yet</p>
                <Link
                  to="/studio/calendar"
                  className="inline-block text-xs font-semibold text-secondary hover:underline mt-2"
                >
                  Plan your week →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflow templates — visible to guests */}
      <section className="py-8 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-primary">Workflow templates</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pre-built AI pipelines — connect wallet to use one</p>
          </div>
          <Link to="/studio/workflows/templates" className="text-xs text-secondary hover:underline">
            View all
          </Link>
        </div>
        {templatesLoading ? (
          <p className="text-sm text-slate-500">Loading templates…</p>
        ) : featuredTemplates.length === 0 ? (
          <p className="text-sm text-slate-500">No templates available yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredTemplates.map((t) => (
              <div
                key={t._id}
                className="bg-white border border-surface-variant rounded-xl p-4 flex flex-col hover:border-secondary/40 transition-colors"
              >
                <span className="text-[10px] uppercase font-bold text-secondary">{t.category}</span>
                <h3 className="text-sm font-semibold text-primary mt-1">{t.name}</h3>
                <p className="text-xs text-slate-500 mt-1 flex-1 line-clamp-2">{t.description}</p>
                <button
                  type="button"
                  onClick={() =>
                    runWithWallet(async () => {
                      const { data: res } = await api.post(WORKFLOW_API.templateDuplicate(t._id));
                      if (res?.success) {
                        toast.success("Workflow created from template");
                        navigate(`/studio/workflows/${res.data._id}`);
                      }
                    })
                  }
                  className="mt-3 w-full py-1.5 text-xs font-bold rounded-md bg-[#031634] text-white hover:opacity-90"
                >
                  Use template
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Center: active projects */}
      <section className="py-8 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-primary">Active projects</h2>
          <Link to="/studio/projects" className="text-xs text-secondary hover:underline">
            View all
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {projects.slice(0, 5).map((p) => {
            const stats = projectStats[String(p._id)] || { drafts: 0, published: 0 };
            const color = projectColor(p.title, p.color);
            const active = isProjectActive(p.updatedAt);
            return (
              <motion.div
                key={p._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ y: -4 }}
                className="min-w-[220px] max-w-[220px] shrink-0"
              >
                <Link
                  to={`/studio/projects/${p._id}`}
                  className="block bg-white border border-surface-variant rounded-lg overflow-hidden h-full hover:border-secondary/40 hover:shadow-sm transition-all"
                >
                  <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: color }}
                      >
                        {p.title?.charAt(0)?.toUpperCase() || "P"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary text-sm truncate">{p.title}</p>
                        <p className="text-[11px] text-slate-500">{formatEditedAgo(p.updatedAt)}</p>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${active ? "bg-emerald-500" : "bg-slate-300"}`}
                        title={active ? "Active" : "Paused"}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {stats.drafts} draft{stats.drafts === 1 ? "" : "s"} · {stats.published} published
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}

          <Link
            to="/studio/projects"
            className="min-w-[220px] max-w-[220px] shrink-0 flex flex-col items-center justify-center h-[148px] border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-secondary hover:text-secondary hover:bg-white transition-colors"
          >
            <span className="material-symbols-outlined text-3xl text-slate-300">add</span>
            <span className="text-sm font-semibold mt-2">Create new project</span>
          </Link>

          {projects.length > 0 && (
            <div className="min-w-[180px] shrink-0 bg-white border border-surface-variant rounded-lg p-4 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Overview</p>
              <p className="text-2xl font-bold text-primary">{projects.length}</p>
              <p className="text-xs text-slate-500">projects</p>
              <p className="text-xs text-slate-500 mt-2">
                {totalDrafts} drafts · {totalPublished} published
              </p>
            </div>
          )}
        </div>
        {projects.length === 0 && (
          <p className="text-sm text-on-surface-variant mt-2">No projects yet — create one to organize your blogs.</p>
        )}
      </section>

      {/* Recent drafts — 3 on home; rest on All drafts */}
      <section className="pt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primary">Recent drafts</h2>
          <Link to="/studio/drafts" className="text-xs text-secondary hover:underline">
            All drafts
          </Link>
        </div>
        <ul className="space-y-2">
          {drafts.slice(0, 3).map((post) => (
            <DraftRow key={post._id} post={post} onDelete={(id) => deleteDraftM.mutate(id)} />
          ))}
          {drafts.length === 0 && <p className="text-sm text-on-surface-variant">No drafts yet.</p>}
        </ul>
      </section>
    </div>
  );
}
