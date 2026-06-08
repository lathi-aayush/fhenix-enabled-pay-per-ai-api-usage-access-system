import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import { usePeraLogin } from "../context/PeraLoginContext.jsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import logo from "../assets/logo.png";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import StudioCreditWallet from "../components/studio/StudioCreditWallet.jsx";
import { StudioOverageProvider } from "../components/studio/OverageConsentModal.jsx";

const STUDIO_HOME = { id: "studio-home", path: "/studio", label: "Studio Home", icon: "home" };

const NAV_GROUPS = [
  {
    id: "create",
    label: "CREATE",
    defaultOpen: true,
    items: [
      { id: "workflows", path: "/studio/workflows", label: "Workflow Studio", icon: "account_tree" },
      { id: "blogging-agent", path: "/studio/blogging-agent", label: "Blogging Agent", icon: "article" },
      {
        id: "prompt-generator",
        path: "/studio/prompt-generator",
        label: "Advanced Prompt Generator",
        icon: "auto_awesome",
      },
      {
        id: "creative-workflow",
        path: "/studio/creative-workflow",
        label: "Creative Workflow",
        icon: "linked_services",
      },
      { id: "clipcraft", path: "/studio/clipcraft", label: "ClipCraft", icon: "movie_edit" },
      {
        id: "viral-thumbnail",
        path: "/studio/viral-thumbnail",
        label: "Viral Thumbnail AI",
        icon: "thumbnail_bar",
      },
    ],
  },
  {
    id: "manage",
    label: "MANAGE",
    items: [
      { id: "projects", path: "/studio/projects", label: "Projects", icon: "folder" },
      { id: "drafts", path: "/studio/drafts", label: "Drafts", icon: "edit_note" },
      { id: "published", path: "/studio/published", label: "Published", icon: "publish" },
      { id: "calendar", path: "/studio/calendar", label: "Calendar", icon: "calendar_month" },
      { id: "platforms", path: "/studio/platforms", label: "Platforms", icon: "link" },
    ],
  },
  {
    id: "monitor",
    label: "MONITOR",
    items: [
      { id: "analytics", path: "/studio/analytics", label: "Analytics", icon: "bar_chart" },
      { id: "queue", path: "/studio/queue", label: "Render Queue", icon: "schedule" },
      { id: "exports", path: "/studio/exports", label: "Exports", icon: "download" },
      { id: "storage", path: "/studio/storage", label: "Storage", icon: "cloud" },
    ],
  },
  {
    id: "account",
    label: "ACCOUNT",
    items: [{ id: "apps", path: "/studio/apps", label: "Apps", icon: "apps" }],
  },
];

const ALL_NAV_ITEMS = [STUDIO_HOME, ...NAV_GROUPS.flatMap((g) => g.items)];

const ACCOUNT_NAV_IDS = new Set([
  "projects", "drafts", "published", "calendar", "platforms",
  "analytics", "queue", "exports", "storage", "apps", "plan",
]);

function sidebarActiveId(pathname) {
  const hit = [...ALL_NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((t) => pathname === t.path || pathname.startsWith(t.path + "/"));
  return hit?.id ?? "studio-home";
}

function userInitials(displayName) {
  if (!displayName?.trim()) return "?";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

function sectionTitle(pathname, activeId) {
  if (pathname === "/studio" || pathname === "/studio/") return "Studio Home";
  const item = ALL_NAV_ITEMS.find((t) => t.id === activeId);
  return item?.label ?? "Studio";
}

function navLinkClass(isActive) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-full transition-colors duration-150 ${
    isActive
      ? "bg-primary text-white font-semibold shadow-sm"
      : "text-slate-600 hover:bg-slate-100"
  }`;
}

function StudioNavLink({ item, isActive, user, onLockedClick }) {
  const locked = ACCOUNT_NAV_IDS.has(item.id) && !user;

  if (locked) {
    return (
      <button
        type="button"
        onClick={() => onLockedClick(item.path)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-full w-full text-left text-slate-400 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
        <span className="truncate flex-1">{item.label}</span>
        <span className="material-symbols-outlined text-[16px]">lock</span>
      </button>
    );
  }

  return (
    <Link to={item.path} className={navLinkClass(isActive)}>
      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function StudioLayout() {
  const { user, isAuthenticated } = useAuth();
  const { connectWithPera } = usePeraLogin();
  const { pathname } = useLocation();
  const active = sidebarActiveId(pathname);
  const isWorkflowBuilder =
    /\/studio\/workflows\/[^/]+$/.test(pathname) &&
    !pathname.includes("templates") &&
    !pathname.includes("history");

  const [algodServer, setAlgodServer] = useState(
    import.meta.env.VITE_ALGO_NODE_URL?.trim() || "https://testnet-api.algonode.cloud"
  );
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.defaultOpen ?? false]))
  );

  useEffect(() => {
    api.get("/api/public/network").then(({ data }) => {
      if (data?.algodServer) setAlgodServer(data.algodServer);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const group = NAV_GROUPS.find((g) => g.items.some((item) => active === item.id));
    if (group) {
      setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
    }
  }, [active]);

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => {
      const { data } = await api.get("/api/studio/usage");
      return data;
    },
    enabled: Boolean(user),
  });

  const limit = usage?.monthlyBlogLimit;
  const used = usage?.monthlyBlogsUsed ?? 0;
  const promptLimit = usage?.monthlyPromptLimit;
  const promptsUsed = usage?.monthlyPromptsUsed ?? 0;
  const onPromptPage =
    pathname.startsWith("/studio/prompt-generator") ||
    pathname.startsWith("/studio/viral-thumbnail") ||
    pathname.startsWith("/studio/creative-workflow") ||
    pathname.startsWith("/studio/agentic-pipeline");
  const usagePct =
    onPromptPage && promptLimit != null && promptLimit > 0
      ? Math.min(100, (promptsUsed / promptLimit) * 100)
      : limit != null && limit > 0
        ? Math.min(100, (used / limit) * 100)
        : 0;
  const usageLabel =
    onPromptPage && promptLimit != null
      ? `${promptsUsed} of ${promptLimit} prompts used`
      : limit != null
        ? `${used} of ${limit} blogs used`
        : `${usage?.tier || "free"} plan`;

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || "Creator";

  const sectionLabel = sectionTitle(pathname, active);
  const isStudioHome = pathname === "/studio" || pathname === "/studio/";

  return (
    <StudioOverageProvider algodServer={algodServer}>
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-100 z-50 flex items-center justify-between px-4 md:pl-[252px]">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/studio" className="flex items-center gap-2 shrink-0" title="Studio Home">
            <img src={logo} alt="Studio Home" className="w-8 h-8 rounded-lg object-contain border border-slate-200" />
            <span className="font-headline font-semibold text-primary text-sm hidden sm:inline">Studio Home</span>
          </Link>
          {!isStudioHome && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-sm font-semibold text-slate-700 truncate">{sectionLabel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} variant="pills" />}
          {isAuthenticated ? (
            <ProfileDropdown />
          ) : (
            <button
              type="button"
              onClick={() => connectWithPera({ redirect: pathname })}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#031634] text-white rounded-full text-sm font-semibold hover:bg-[#0a2855] transition-all cursor-pointer"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <aside className="fixed left-0 top-14 bottom-0 w-[240px] bg-slate-50 border-r border-slate-100 flex flex-col pt-4 pb-5 text-[0.875rem] overflow-y-auto scrollbar-hide z-40 max-md:hidden">
        <div className="px-4 mb-5">
          <Link to="/studio" className="block rounded-lg p-2 -mx-2 hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {userInitials(user?.displayName)}
              </div>
              <p className="font-headline font-semibold text-slate-900 text-sm truncate">
                Hey {firstName} 👋
              </p>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  {usage?.tier || "free"} plan
                </span>
                <span className="text-[10px] text-slate-500">{usageLabel}</span>
              </div>
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={false}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2">
          <Link to={STUDIO_HOME.path} className={navLinkClass(active === STUDIO_HOME.id)}>
            <span className="material-symbols-outlined text-[20px]">{STUDIO_HOME.icon}</span>
            <span>{STUDIO_HOME.label}</span>
          </Link>

          {NAV_GROUPS.map((group) => {
            const isOpen = openGroups[group.id];
            const hasActiveChild = group.items.some((item) => active === item.id);
            return (
              <div key={group.id} className="mt-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    hasActiveChild ? "text-slate-500" : "text-slate-400 hover:text-slate-500"
                  }`}
                >
                  <span>{group.label}</span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform duration-150 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    chevron_right
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => (
                      <StudioNavLink
                        key={item.path}
                        item={item}
                        isActive={active === item.id}
                        user={user}
                        onLockedClick={(path) => connectWithPera({ redirect: path })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto px-4 pt-4 border-t border-slate-200 space-y-2">
          <StudioCreditWallet usage={usage} />
          {user ? (
            <Link
              to="/studio/plan"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity duration-200"
            >
              <span aria-hidden>⚡</span>
              Upgrade Plan
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => connectWithPera({ redirect: "/studio/plan" })}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity duration-200 cursor-pointer"
            >
              <span aria-hidden>⚡</span>
              Connect to Upgrade
            </button>
          )}
          <Link to="/marketplace/browse" className="text-[11px] text-secondary hover:underline block text-center">
            Switch to Marketplace →
          </Link>
          {user?.role === "creator" && (
            <Link
              to="/creator"
              className="text-[11px] text-indigo-600 hover:underline block text-center font-semibold"
            >
              Go to Creator Dashboard →
            </Link>
          )}
        </div>
      </aside>

      <main className="md:ml-[240px] pt-14 min-h-screen">
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
    </StudioOverageProvider>
  );
}
