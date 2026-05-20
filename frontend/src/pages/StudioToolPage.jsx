import React from "react";
import { Link } from "react-router-dom";

export default function StudioToolPage({ tool, description, icon }) {
  return (
    <div className="pt-6 max-w-5xl">
      <div className="bg-white border border-surface-variant rounded-md p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-700">{icon}</span>
          <h1 className="font-headline text-2xl font-semibold text-primary">{tool}</h1>
        </div>
        <p className="text-sm text-on-surface-variant mt-2">{description}</p>
        <div className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
          <button type="button" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
            Start New Project
          </button>
          <button type="button" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
            Open Last Draft
          </button>
          <Link to="/studio/queue" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors text-center">
            Check Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
