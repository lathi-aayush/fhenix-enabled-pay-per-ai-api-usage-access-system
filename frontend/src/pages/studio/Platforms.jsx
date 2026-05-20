import React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";

const PLATFORMS = [
  { id: "medium", label: "Medium" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "devto", label: "Dev.to" },
  { id: "hashnode", label: "Hashnode" },
  { id: "wordpress", label: "WordPress" },
];

export default function Platforms() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["studio-platforms"],
    queryFn: async () => (await api.get("/api/studio/platforms")).data,
  });
  const [platform, setPlatform] = useState("medium");
  const [token, setToken] = useState("");

  const connectM = useMutation({
    mutationFn: () => api.post("/api/studio/platforms/connect", { platform, accessToken: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-platforms"] });
      toast.success("Platform connected");
      setToken("");
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

  return (
    <div className="pt-6 max-w-3xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Platforms</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Connect publishing targets (OAuth flows can be wired to env-based apps). For now, paste an access token from your provider.
      </p>

      <div className="bg-white border border-surface-variant rounded-md p-5 mb-8">
        <h2 className="font-semibold text-primary text-sm mb-3">Connect</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-600">Platform</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-600">Access token</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm mt-1 font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token"
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-4 px-4 py-2 bg-[#031634] text-white text-sm rounded-md disabled:opacity-40"
          disabled={!token || connectM.isPending}
          onClick={() => connectM.mutate()}
        >
          Save connection
        </button>
      </div>

      <h2 className="font-semibold text-primary text-sm mb-3">Connected</h2>
      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="bg-white border border-surface-variant rounded-md px-4 py-3 flex justify-between items-center text-sm">
            <span className="capitalize font-medium">{p.platform}</span>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => disconnectM.mutate(p.id)}>
              Disconnect
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && items.length === 0 && <p className="text-sm text-on-surface-variant">No platforms connected.</p>}
    </div>
  );
}
