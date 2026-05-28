import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

const nav = [
  { id: "studio-home", path: "/studio", label: "Studio Home", icon: "home" },
  { id: "workflows", path: "/studio/workflows", label: "Workflow Studio", icon: "account_tree" },
  { id: "blogging-agent", path: "/studio/blogging-agent", label: "Blogging Agent", icon: "article" },
  { id: "clipcraft", path: "/studio/clipcraft", label: "ClipCraft", icon: "movie_edit" },
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
  const pct = limit != null && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-100 h-14 flex items-center px-4 md:pl-[240px]">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider md:hidden">SentinelAI Studio</span>
        <div className="ml-auto flex items-center gap-3">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} />}
          <ProfileDropdown />
        </div>
      </header>

      <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-slate-50 border-r border-slate-100 flex flex-col pt-14 pb-6 text-[0.875rem] overflow-y-auto z-40 max-md:hidden">
        <div className="px-5 mb-6">
          <p className="font-headline font-semibold text-slate-900 text-sm">SentinelAI Studio</p>
          <p className="text-slate-500 text-[10px] mt-0.5">Creator workspace</p>
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
            {usage?.tier || "free"} plan · blogs
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#031634]"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <p className="text-[11px] text-slate-600">
            {used}
            {limit != null ? ` of ${limit}` : ""} used this month
          </p>
          {limit != null && used >= limit && (
            <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
              Limit reached — upgrade to generate more blogs.
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
