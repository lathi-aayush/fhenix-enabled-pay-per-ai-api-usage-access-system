import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import MegaNav from "../components/MegaNav.jsx";

const nav = [
  { id: "studio-home", path: "/studio", label: "Studio Home", icon: "home" },
  { id: "workflows", path: "/studio/workflows", label: "Workflow Studio", icon: "account_tree" },
  { id: "blogging-agent", path: "/studio/blogging-agent", label: "Blogging Agent", icon: "article" },
  {
    id: "prompt-generator",
    path: "/studio/prompt-generator",
    label: "Advanced Prompt Generator",
    icon: "auto_awesome",
  },
  {
    id: "viral-thumbnail",
    path: "/studio/viral-thumbnail",
    label: "Viral Thumbnail AI",
    icon: "thumbnail_bar",
  },
  {
    id: "creative-workflow",
    path: "/studio/creative-workflow",
    label: "Creative Workflow",
    icon: "linked_services",
  },
  { id: "clipcraft", path: "/studio/clipcraft", label: "ClipCraft", icon: "movie_edit" },
  { id: "chat", path: "/studio/chat", label: "AI Chat", icon: "chat" },
  { id: "projects", path: "/studio/projects", label: "Projects", icon: "folder" },
  { id: "calendar", path: "/studio/calendar", icon: "calendar_month", label: "Calendar" },
  { id: "drafts", path: "/studio/drafts", icon: "edit_note", label: "Drafts" },
  { id: "published", path: "/studio/published", icon: "publish", label: "Published" },
  { id: "platforms", path: "/studio/platforms", icon: "link", label: "Platforms" },
  { id: "analytics", path: "/studio/analytics", icon: "bar_chart", label: "Analytics" },
  { id: "plan", path: "/studio/plan", icon: "workspace_premium", label: "Plan & upgrade" },
  { id: "queue", path: "/studio/queue", icon: "schedule", label: "Render Queue" },
  { id: "exports", path: "/studio/exports", icon: "upload_file", label: "Exports" },
  { id: "storage", path: "/studio/storage", icon: "database", label: "Storage" },
  { id: "apps", path: "/studio/apps", icon: "apps", label: "Apps" },
];

function sidebarActiveId(pathname) {
  const hit = [...nav].sort((a, b) => b.path.length - a.path.length).find((t) => pathname === t.path || pathname.startsWith(t.path + "/"));
  return hit?.id ?? "studio-home";
}

export default function StudioLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const active = sidebarActiveId(pathname);
  const isWorkflowBuilder =
    /\/studio\/workflows\/[^/]+$/.test(pathname) &&
    !pathname.includes("templates") &&
    !pathname.includes("history");

  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => {
      const { data } = await api.get("/api/studio/usage");
      return data;
    },
  });

  const limit = usage?.monthlyBlogLimit;
  const used = usage?.monthlyBlogsUsed ?? 0;
  const promptLimit = usage?.monthlyPromptLimit;
  const promptsUsed = usage?.monthlyPromptsUsed ?? 0;
  const pct = limit != null && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const promptPct =
    promptLimit != null && promptLimit > 0 ? Math.min(100, (promptsUsed / promptLimit) * 100) : 0;
  const onPromptPage =
    pathname.startsWith("/studio/prompt-generator") ||
    pathname.startsWith("/studio/viral-thumbnail") ||
    pathname.startsWith("/studio/creative-workflow");

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <MegaNav />

      <aside className="fixed left-0 top-14 bottom-0 w-[220px] bg-slate-50 border-r border-slate-100 flex flex-col pt-3 pb-6 text-[0.875rem] overflow-y-auto scrollbar-hide z-40 max-md:hidden">
        <div className="px-4 mb-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md p-2 -mx-2 hover:bg-slate-100 transition-colors group"
            title="Back to Sentinal home"
          >
            <img
              src={logo}
              alt="Sentinal"
              className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-headline font-semibold text-slate-900 text-sm group-hover:text-[#031634]">
                Sentinal
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5 truncate">Studio · tap for home</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {nav.map((item) => {
            const isActive = active === item.id;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md transition-colors ${
                  isActive ? "bg-slate-200/80 text-slate-900 font-semibold" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-4 pt-4 border-t border-slate-200 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            {usage?.tier || "free"} plan · {onPromptPage ? "prompts" : "blogs"}
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#031634]"
              initial={false}
              animate={{ width: `${onPromptPage ? promptPct : pct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-[11px] text-slate-600">
            {onPromptPage ? (
              <>
                {promptsUsed}
                {promptLimit != null ? ` of ${promptLimit}` : ""} prompts this month
              </>
            ) : (
              <>
                {used}
                {limit != null ? ` of ${limit}` : ""} blogs this month
              </>
            )}
          </p>
          {onPromptPage && promptLimit != null && promptsUsed >= promptLimit && (
            <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              Prompt limit reached — upgrade for more.
            </p>
          )}
          {!onPromptPage && limit != null && used >= limit && (
            <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              Blog limit reached — upgrade for more.
            </p>
          )}
          <Link
            to="/studio/plan"
            className="flex items-center justify-center w-full text-center text-xs font-semibold py-2 rounded-md bg-[#031634] text-white hover:opacity-90 transition-opacity"
          >
            Upgrade plan
          </Link>
          <Link to="/dashboard/home" className="text-[11px] text-secondary hover:underline block text-center">
            Switch to Marketplace →
          </Link>
        </div>
      </aside>

      <main className="md:ml-[220px] pt-14 min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={isWorkflowBuilder ? "pb-0 max-w-none px-0" : "px-4 sm:px-6 pb-16 max-w-6xl mx-auto"}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
