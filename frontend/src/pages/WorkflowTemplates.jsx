import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { WORKFLOW_API } from "../api/workflowApi.js";

const CATEGORIES = ["All", "Writing", "Code", "Data", "Research", "Media"];

export default function WorkflowTemplates() {
  const [category, setCategory] = useState("All");
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-templates", category],
    queryFn: async () =>
      (await api.get(WORKFLOW_API.templates, { params: category !== "All" ? { category } : {} })).data,
  });

  const templates = data?.data ?? [];

  async function useTemplate(id) {
    try {
      const { data: res } = await api.post(WORKFLOW_API.templateDuplicate(id));
      if (res?.success) {
        toast.success("Workflow created from template");
        navigate(`/studio/workflows/${res.data._id}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to use template");
    }
  }

  return (
    <div className="pt-6">
      <header className="mb-6">
        <Link to="/studio/workflows" className="text-xs text-secondary hover:underline font-semibold">
          ← Workflows
        </Link>
        <h1 className="font-headline text-2xl font-semibold text-primary mt-2">Template marketplace</h1>
        <p className="text-sm text-on-surface-variant mt-1">One-click duplicate into your workflow library.</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              category === c
                ? "bg-[#031634] text-white border-[#031634]"
                : "bg-white text-slate-600 border-surface-variant hover:bg-slate-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-600 mb-4">
          Could not load templates. Ensure the backend is running on port 5001.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-600 text-sm">
          No templates yet. Open the backend once to seed defaults, or create a workflow from scratch.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t._id}
              className="bg-white border border-surface-variant rounded-xl p-5 flex flex-col shadow-sm hover:border-secondary transition-colors"
            >
              <span className="text-[10px] uppercase font-bold text-secondary">{t.category}</span>
              <h3 className="text-lg font-semibold text-primary mt-1">{t.name}</h3>
              <p className="text-xs text-on-surface-variant mt-2 flex-1">{t.description}</p>
              <p className="text-[10px] text-slate-500 mt-2">
                ~{t.estimatedCreditsPerRun} ALGO/run · {t.usageCount} uses · ★ {t.rating}
              </p>
              <button
                type="button"
                onClick={() => useTemplate(t._id)}
                className="mt-4 w-full py-2 text-xs font-bold rounded-md bg-[#031634] text-white hover:opacity-90"
              >
                Use template
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
