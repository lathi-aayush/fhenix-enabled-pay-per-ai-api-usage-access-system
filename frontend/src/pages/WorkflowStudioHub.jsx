import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { WORKFLOW_API } from "../api/workflowApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWalletAction } from "../hooks/useWalletAction.js";
import GuestConnectBanner from "../components/GuestConnectBanner.jsx";

export default function WorkflowStudioHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { runWithWallet } = useWalletAction();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => (await api.get(WORKFLOW_API.list)).data,
    enabled: Boolean(user),
  });

  async function createWorkflow() {
    try {
      const { data: res } = await api.post(WORKFLOW_API.create, {
        name: "Untitled Workflow",
        description: "",
      });
      if (res?.success) {
        queryClient.invalidateQueries({ queryKey: ["workflows"] });
        navigate(`/studio/workflows/${res.data._id}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to create workflow");
    }
  }

  const items = data?.data?.items ?? [];

  return (
    <div className="pt-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary">Workflow Studio</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Build pipelines with Groq AI, Blog Agent, and Studio creative nodes — Prompt Generator → Image
            Generator (Gemini).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/studio/workflows/templates"
            className="px-4 py-2 text-sm font-semibold border border-surface-variant rounded-md hover:bg-slate-50"
          >
            Templates
          </Link>
          <Link
            to="/studio/workflows/history"
            className="px-4 py-2 text-sm font-semibold border border-surface-variant rounded-md hover:bg-slate-50"
          >
            History
          </Link>
          <button
            type="button"
            onClick={() => runWithWallet(() => createWorkflow())}
            className="px-4 py-2 text-sm font-semibold bg-[#031634] text-white rounded-md hover:opacity-90"
          >
            New workflow
          </button>
        </div>
      </header>

      {!isAuthenticated && (
        <GuestConnectBanner
          message="Connect Pera Wallet to create and run workflows."
          className="mb-4"
        />
      )}

      {error && isAuthenticated && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Could not reach the workflow API. Ensure the backend is running on port{" "}
          <code className="text-xs">5000</code> (or set{" "}
          <code className="text-xs">VITE_PROXY_TARGET</code> in <code className="text-xs">frontend/.env</code>).
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading workflows…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-600 mb-4">No workflows yet. Start from a template or create one.</p>
          <button
            type="button"
            onClick={() => runWithWallet(() => createWorkflow())}
            className="text-sm font-bold text-[#031634] underline"
          >
            Create your first workflow
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((w) => (
            <Link
              key={w._id}
              to={`/studio/workflows/${w._id}`}
              className="block bg-white border border-surface-variant rounded-xl p-5 hover:border-secondary transition-colors"
            >
              <h3 className="font-semibold text-primary">{w.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{w.description || "No description"}</p>
              <p className="text-[10px] text-slate-400 mt-3">
                {w.nodes?.length ?? 0} nodes · {w.status} · updated {new Date(w.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
      <button type="button" className="sr-only" onClick={() => refetch()}>
        refresh
      </button>
    </div>
  );
}
