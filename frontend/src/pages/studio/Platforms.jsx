import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";

const PLATFORM_IDS = ["devto", "medium", "linkedin", "hashnode", "wordpress"];

export default function Platforms() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["studio-platforms"],
    queryFn: async () => (await api.get("/api/studio/platforms")).data,
  });
  const { data: setupData } = useQuery({
    queryKey: ["studio-platforms-setup"],
    queryFn: async () => (await api.get("/api/studio/platforms/setup")).data,
  });

  const setup = setupData?.platforms || {};
  const [platform, setPlatform] = useState("devto");
  const [token, setToken] = useState("");
  const [meta, setMeta] = useState({});

  const currentSetup = setup[platform] || {};

  const connectM = useMutation({
    mutationFn: () =>
      api.post("/api/studio/platforms/connect", {
        platform,
        accessToken: token,
        metadata: meta,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-platforms"] });
      toast.success(`${currentSetup.label || platform} connected`);
      setToken("");
      setMeta({});
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  const disconnectM = useMutation({
    mutationFn: (id) => api.delete(`/api/studio/platforms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-platforms"] });
      toast.success("Disconnected");
    },
  });

  const items = data?.platforms ?? [];

  const metaFields = currentSetup.metadataFields || [];

  return (
    <div className="pt-6 max-w-3xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Platforms</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Connect Dev.to, Medium, LinkedIn, Hashnode, or WordPress with API tokens. Then publish or schedule from{" "}
        <strong>Blogging Agent</strong> or <strong>Workflow Studio</strong>.
      </p>

      <div className="bg-white border border-surface-variant rounded-xl p-5 mb-8 shadow-sm">
        <h2 className="font-semibold text-primary text-sm mb-3">Connect a platform</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-slate-600 font-semibold">Platform</label>
            <select
              className="w-full border border-surface-variant rounded-md px-3 py-2 text-sm mt-1"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setMeta({});
              }}
            >
              {PLATFORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {setup[id]?.label || id}
                </option>
              ))}
            </select>
          </div>

          {currentSetup.tokenHelp && (
            <p className="text-[11px] text-secondary bg-slate-50 rounded px-2 py-1.5">
              {currentSetup.tokenHelp}
            </p>
          )}

          <div>
            <label className="text-xs text-slate-600 font-semibold">
              {currentSetup.tokenLabel || "Access token"}
            </label>
            <input
              className="w-full border border-surface-variant rounded-md px-3 py-2 text-sm mt-1 font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={platform === "devto" ? "Paste API key only (no Bearer prefix)" : "Paste API key / token"}
              autoComplete="off"
            />
          </div>

          {metaFields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-slate-600 font-semibold">{f.label}</label>
              <input
                className="w-full border border-surface-variant rounded-md px-3 py-2 text-sm mt-1"
                value={meta[f.key] || ""}
                onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ""}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 px-4 py-2 bg-[#031634] text-white text-sm font-semibold rounded-md disabled:opacity-40"
          disabled={!token.trim() || connectM.isPending}
          onClick={() => connectM.mutate()}
        >
          Save connection
        </button>
      </div>

      <h2 className="font-semibold text-primary text-sm mb-3">Connected</h2>
      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}
      <ul className="space-y-2">
        {items.map((p) => (
          <li
            key={p.id}
            className="bg-white border border-surface-variant rounded-md px-4 py-3 flex justify-between items-center text-sm"
          >
            <div>
              <span className="capitalize font-medium text-primary">{p.platform}</span>
              <span className="ml-2 text-[10px] text-emerald-700 font-semibold">Ready</span>
              {p.metadata?.authorUrn && (
                <p className="text-[10px] text-slate-500 font-mono truncate max-w-xs">{p.metadata.authorUrn}</p>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-red-600 hover:underline shrink-0"
              onClick={() => disconnectM.mutate(p.id)}
            >
              Disconnect
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-on-surface-variant">
          No platforms connected yet. Connect Dev.to first (easiest — just an API key).
        </p>
      )}
    </div>
  );
}
