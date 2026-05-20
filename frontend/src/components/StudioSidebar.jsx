import React from "react";
import { Link } from "react-router-dom";

export default function StudioSidebar({ activeTab }) {
  const tabs = [
    { id: "studio-home", path: "/studio", icon: "home", label: "Studio Home" },
    { id: "video-editor", path: "/studio/video-editor", icon: "movie", label: "Video Editor" },
    { id: "blog-writer", path: "/studio/blog-writer", icon: "article", label: "Blog Writer" },
    { id: "data-analyst", path: "/studio/data-analyst", icon: "monitoring", label: "Data Analyst" },
    { id: "projects", path: "/studio/projects", icon: "folder", label: "Projects" },
    { id: "queue", path: "/studio/queue", icon: "schedule", label: "Render Queue" },
    { id: "exports", path: "/studio/exports", icon: "upload_file", label: "Exports" },
    { id: "storage", path: "/studio/storage", icon: "database", label: "Storage" },
    { id: "apps", path: "/studio/apps", icon: "apps", label: "Apps" },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
      <div className="px-6 mb-8">
        <h3 className="text-slate-900 font-semibold">Studio</h3>
        <p className="text-slate-500 text-xs">Creator Workspace</p>
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
