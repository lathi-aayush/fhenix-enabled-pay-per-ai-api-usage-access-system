import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserSidebar({ activeTab }) {
  const { user } = useAuth();
  const tabs = [
    { id: "home", path: "/dashboard/home", icon: "home", label: "Home" },
    { id: "marketplace", path: "/dashboard/browse", icon: "storefront", label: "Marketplace" },
    { id: "studio", path: "/studio", icon: "widgets", label: "Studio" },
    { id: "apps", path: "/studio/apps", icon: "apps", label: "Apps" },
    { id: "analytics", path: "/dashboard/usage", icon: "insights", label: "Analytics" },
    { id: "billing", path: "/billing/transactions", icon: "receipt_long", label: "Billing" },
  ];
  const sectionLinks = [
    {
      title: "Marketplace",
      items: [
        { label: "Browse APIs", path: "/dashboard/browse" },
        { label: "My API Keys", path: "/dashboard/keys" },
        { label: "Usage", path: "/dashboard/usage" },
        { label: "Transactions", path: "/billing/transactions" },
        { label: "x402 Agentic Docs", path: "/docs/x402" },
      ],
    },
    {
      title: "Studio",
      items: [
        { label: "Blogging Agent", path: "/studio/blogging-agent" },
        { label: "Video Editor", path: "/studio/video-editor" },
        { label: "Data Analyst", path: "/studio/data-analyst" },
        { label: "Projects", path: "/studio/projects" },
        { label: "Render Queue", path: "/studio/queue" },
      ],
    },
    {
      title: "Creator Dashboard",
      items: user?.role === "creator"
        ? [
            { label: "Endpoints", path: "/creator" },
            { label: "Revenue", path: "/creator" },
            { label: "Analytics", path: "/creator" },
            { label: "Call Logs", path: "/creator" },
          ]
        : [{ label: "Switch to creator role", path: "/" }],
    },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
      <div className="px-6 mb-8">
        <h3 className="text-slate-900 font-semibold">SentinelAI</h3>
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
