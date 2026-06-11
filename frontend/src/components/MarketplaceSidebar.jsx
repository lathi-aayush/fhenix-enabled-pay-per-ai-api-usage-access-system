import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { usePeraLogin } from "../context/PeraLoginContext.jsx";

import logo from "../assets/logo.png";

export const BROWSE_TABS = [
  { id: "browse", path: "/marketplace/browse", icon: "storefront", label: "Browse APIs" },
  { id: "creators", path: "/marketplace/creators", icon: "group", label: "Creator Profiles" },
];

export const ACCOUNT_TABS = [
  { id: "home", path: "/dashboard/home", icon: "home", label: "Home" },
  { id: "keys", path: "/dashboard/keys", icon: "key", label: "My Keys" },
  { id: "usage", path: "/dashboard/usage", icon: "insights", label: "Usage" },
  { id: "transactions", path: "/billing/transactions", icon: "receipt_long", label: "Transactions" },
];

export const DOC_TABS = [
  { id: "x402", path: "/docs/x402", icon: "integration_instructions", label: "x402 Agentic Docs" },
  { id: "x402-api", path: "/docs/x402-api", icon: "menu_book", label: "x402 API Reference" },
];

export const NAV_GROUPS = [
  { id: "browse", label: "BROWSE", defaultOpen: true, items: BROWSE_TABS },
  { id: "account", label: "ACCOUNT", items: ACCOUNT_TABS },
  { id: "docs", label: "DOCS", items: DOC_TABS },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const ACCOUNT_NAV_IDS = new Set(ACCOUNT_TABS.map((t) => t.id));

export function sidebarActiveId(pathname) {
  if (pathname.startsWith("/marketplace/services/")) return "browse";
  const hit = [...ALL_NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((t) => pathname === t.path || pathname.startsWith(t.path + "/"));
  return hit?.id ?? "browse";
}

export function sectionTitle(pathname, activeId) {
  if (pathname.startsWith("/marketplace/services/")) return "Service Detail";
  const item = ALL_NAV_ITEMS.find((t) => t.id === activeId);
  return item?.label ?? "Marketplace";
}

function userInitials(displayName) {
  if (!displayName?.trim()) return "?";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

function navLinkClass(isActive) {
  return `flex items-center gap-2.5 px-3 py-2 rounded-full transition-colors duration-150 ${
    isActive
      ? "bg-primary text-white font-semibold shadow-sm"
      : "text-slate-600 hover:bg-slate-100"
  }`;
}

function MarketplaceNavLink({ item, isActive, user, onLockedClick }) {
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

export default function MarketplaceSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { connectWithPera } = usePeraLogin();
  const active = sidebarActiveId(pathname);

  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.defaultOpen ?? false]))
  );

  useEffect(() => {
    const group = NAV_GROUPS.find((g) => g.items.some((item) => active === item.id));
    if (group) {
      setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
    }
  }, [active]);

  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const firstName = user?.displayName?.trim().split(/\s+/)[0] || "Developer";

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-[240px] bg-slate-50 border-r border-slate-100 flex flex-col pt-4 pb-5 text-[0.875rem] overflow-y-auto scrollbar-hide z-40 max-md:hidden">
      <div className="px-4 mb-5">
        <Link to="/marketplace/browse" className="block rounded-lg p-2 -mx-2 hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-3">
            {user?.displayName ? (
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {userInitials(user?.displayName)}
              </div>
            ) : (
              <img
                src={logo}
                alt="Studio Logo"
                className="w-10 h-10 rounded-lg object-contain border border-slate-200 shrink-0 bg-white p-1"
              />
            )}
            <p className="font-headline font-semibold text-slate-900 text-sm truncate">
              Hey {firstName} 👋
            </p>
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Marketplace</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Browse &amp; integrate AI APIs</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.id];
          const hasActiveChild = group.items.some((item) => active === item.id);
          return (
            <div key={group.id} className="mt-1 first:mt-0">
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
                    <MarketplaceNavLink
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
        {user ? (
          <Link
            to="/dashboard/home"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity duration-200"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            My Dashboard
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => connectWithPera({ redirect: "/marketplace/browse" })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            Connect Wallet
          </button>
        )}
        <Link to="/studio" className="text-[11px] text-secondary hover:underline block text-center">
          Switch to Studio →
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
  );
}
