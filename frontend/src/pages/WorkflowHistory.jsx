import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { WORKFLOW_API } from "../api/workflowApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import GuestConnectBanner from "../components/GuestConnectBanner.jsx";
import ExecutionPanel from "../components/workflow/controls/ExecutionPanel.jsx";

export default function WorkflowHistory() {
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-runs", page],
    queryFn: async () => (await api.get(WORKFLOW_API.runs, { params: { page, limit: 20 } })).data,
    enabled: Boolean(user),
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  async function openRun(runId) {
    const { data: res } = await api.get(WORKFLOW_API.runOne(runId));
    if (res?.success) {
      setSelectedRun(res.data);
      setPanelOpen(true);
    }
  }

  return (
    <div className="pt-6">
      <div className="flex gap-4 min-h-[70vh]">
      <div className="flex-1">
        <header className="mb-6">
          <Link to="/studio/workflows" className="text-xs text-secondary hover:underline">
            ← Workflows
          </Link>
          <h1 className="font-headline text-2xl font-semibold text-primary mt-2">Run history</h1>
          {!isAuthenticated && (
            <GuestConnectBanner message="Connect Pera Wallet to view workflow run history." className="mt-4" />
          )}
        </header>

        <div className="bg-white border border-surface-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 animate-pulse">
                    Loading…
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r._id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => openRun(r._id)}
                  >
                    <td className="px-4 py-3 font-medium">{r.workflowName}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{(r.totalCreditsDeducted ?? 0).toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs">{r.runtimeMs ? `${r.runtimeMs}ms` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center gap-2 mt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-slate-500 self-center">
            Page {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {panelOpen && (
        <div className="hidden lg:block h-[calc(100vh-8rem)]">
          <ExecutionPanel run={selectedRun} isOpen onClose={() => setPanelOpen(false)} onRerun={() => {}} />
        </div>
      )}
      </div>
    </div>
  );
}
