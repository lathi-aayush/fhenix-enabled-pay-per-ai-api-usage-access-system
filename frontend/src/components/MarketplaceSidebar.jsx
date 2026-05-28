import React from "react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { id: "home", path: "/dashboard/home", icon: "home", label: "Home" },
  { id: "browse", path: "/dashboard/browse", icon: "storefront", label: "Browse APIs" },
  { id: "featured", path: "/dashboard/featured", icon: "star", label: "Featured APIs" },
  { id: "categories", path: "/dashboard/categories", icon: "category", label: "Categories" },
  { id: "keys", path: "/dashboard/keys", icon: "key", label: "My Keys" },
  { id: "usage", path: "/dashboard/usage", icon: "insights", label: "Usage" },
  { id: "transactions", path: "/billing/transactions", icon: "receipt_long", label: "Transactions" },
  { id: "creators", path: "/dashboard/creators", icon: "group", label: "Creator Profiles" },
  { id: "x402", path: "/docs/x402", icon: "integration_instructions", label: "x402 Agentic Docs" },
  { id: "x402-api", path: "/docs/x402-api", icon: "menu_book", label: "x402 API Reference" },
];

function activeTabFromPath(pathname) {
  if (pathname.startsWith("/dashboard/services/")) return "browse";
  const hit = [...tabs].sort((a, b) => b.path.length - a.path.length).find((t) => pathname === t.path || pathname.startsWith(t.path + "/"));
  return hit?.id ?? "home";
}

export default function MarketplaceSidebar() {
  const { pathname } = useLocation();
  const activeTab = activeTabFromPath(pathname);

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
      <div className="px-6 mb-8">
        <h3 className="text-slate-900 font-semibold">Marketplace</h3>
        <p className="text-slate-500 text-xs">Developer Infrastructure</p>
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`flex items-center gap-3 px-6 py-3 transition-colors ${
              isActive
                ? "text-slate-900 font-semibold bg-slate-100 border-r-2 border-slate-900"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </aside>
  );
}
