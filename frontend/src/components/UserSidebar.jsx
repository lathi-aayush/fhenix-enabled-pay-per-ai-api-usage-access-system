import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserSidebar({ activeTab }) {
  const { user } = useAuth();
  const tabs = [
    { id: "home", path: "/dashboard/home", icon: "home", label: "Home" },
    { id: "marketplace", path: "/marketplace/browse", icon: "storefront", label: "Marketplace" },
    { id: "studio", path: "/studio", icon: "widgets", label: "Studio" },
    { id: "analytics", path: "/dashboard/usage", icon: "insights", label: "Analytics" },
    { id: "billing", path: "/billing/transactions", icon: "receipt_long", label: "Billing" },
    { id: "contract", path: "/dashboard/contract", icon: "gavel", label: "Smart Contract" },
  ];
  const sectionLinks = [
    {
      title: "Marketplace",
      items: [
        { label: "Browse APIs", path: "/marketplace/browse" },
        { label: "My API Keys", path: "/dashboard/keys" },
        { label: "Creators", path: "/marketplace/creators" },
        { label: "Usage", path: "/dashboard/usage" },
        { label: "Gateway Wallet", path: "/dashboard/gateway" },
        { label: "API Marketplace", path: "/marketplace/gateway" },
        { label: "Smart Contract Stats", path: "/dashboard/contract" },
        { label: "Transactions", path: "/billing/transactions" },
        { label: "x402 Docs", path: "/docs/x402" },
      ],
    },
    {
      title: "Studio",
      items: [
        { label: "Blogging Agent", path: "/studio/blogging-agent" },
        { label: "Projects", path: "/studio/projects" },
        { label: "Render Queue", path: "/studio/queue" },
      ],
    },
    {
      title: "Creator Dashboard",
      items:
        user?.role === "creator"
          ? [{ label: "Go to Creator Dashboard", path: "/creator" }]
          : [{ label: "Switch to creator role", path: "/" }],
    },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
      <div className="px-6 mb-8">
        <h3 className="text-slate-900 font-semibold">SentinalAI</h3>
        <p className="text-slate-500 text-xs">Marketplace + Studio OS</p>
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
      <div className="mt-8 px-6 space-y-6">
        {sectionLinks.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="block text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
