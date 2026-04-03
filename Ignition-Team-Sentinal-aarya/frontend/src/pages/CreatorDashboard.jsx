import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getPublicApiBase } from "../utils/apiBase.js";

export default function CreatorDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiBase = getPublicApiBase();
  const proxyExample = `${apiBase}/api/mock/v1/chat/completions`;

  async function load() {
    try {
      const [{ data: s }, { data: u }] = await Promise.all([
        api.get("/api/creator/stats"),
        api.get("/api/creator/usage?limit=40"),
      ]);
      setStats(s);
      setUsage(u ?? []);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const services = stats?.services ?? [];

  async function togglePause(svc, nextPaused) {
    try {
      await api.patch(`/api/services/${svc._id}`, { isPaused: nextPaused });
      toast.success(nextPaused ? "Service paused" : "Service live");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Update failed");
    }
  }

  async function removeService(svc) {
    if (!window.confirm(`Delete “${svc.title}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/services/${svc._id}`);
      toast.success("Service deleted");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Delete failed");
    }
  }

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-surface-container-high px-6 py-3 flex justify-between items-center h-16">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-headline font-semibold text-xl tracking-tighter text-primary">
            Sentinal
          </Link>
          <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">
            Creator
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded px-3 py-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">account_balance_wallet</span>
            <span className="text-sm font-mono truncate max-w-[180px] text-primary">{user?.walletAddress}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="text-sm text-on-surface-variant"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-4xl mx-auto pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-headline text-2xl font-semibold text-primary">Overview</h1>
            <p className="text-sm text-on-surface-variant mt-1">Your endpoints and earnings</p>
          </div>
          <Link
            to="/creator/new"
            className="inline-flex items-center justify-center bg-primary text-on-primary px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90"
          >
            Add endpoint
          </Link>
        </div>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="bg-white border border-surface-variant p-6 rounded-md">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide">Total revenue</p>
                <p className="font-headline text-2xl text-primary mt-2">
                  {(stats?.totalRevenue ?? 0).toFixed(4)} ALGO
                </p>
              </div>
              <div className="bg-white border border-surface-variant p-6 rounded-md">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide">Total calls</p>
                <p className="font-headline text-2xl text-primary mt-2">{stats?.totalUses ?? 0}</p>
              </div>
              <div className="bg-white border border-surface-variant p-6 rounded-md">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide">Endpoints</p>
                <p className="font-headline text-2xl text-primary mt-2">{stats?.serviceCount ?? 0}</p>
              </div>
            </div>

            <div className="bg-white border border-surface-variant rounded-md p-5 mb-8">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-1">User-facing proxy URL</p>
              <p className="font-mono text-xs break-all text-secondary">{proxyExample}</p>
              <p className="text-xs text-on-surface-variant mt-2">
                Users attach their Sentinel proxy key; requests hit your configured model with their prepaid balance.
              </p>
            </div>

            <div className="tonal-separator mb-8" />

            <h2 className="font-headline text-lg font-semibold text-primary mb-4">Your endpoints</h2>
            {services.length === 0 ? (
              <p className="text-on-surface-variant text-sm">No endpoints yet. Add one to list on the marketplace.</p>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <div
                    key={s._id}
                    className="bg-white border border-surface-variant rounded-md p-5 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="font-semibold text-primary flex items-center gap-2">
                          {s.title}
                          {s.isPaused && (
                            <span className="text-[10px] uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                              Paused
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {s.aiProvider ?? "—"} · {s.modelName || "—"}{" "}
                          {!s.providerConfigured && (
                            <span className="text-amber-700">(legacy — add provider key via API)</span>
                          )}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{s.description}</p>
                      </div>
                      <div className="text-left sm:text-right text-sm font-mono shrink-0">
                        <p className="text-secondary">{Number(s.price).toFixed(4)} ALGO / call</p>
                        <p className="text-on-surface-variant text-xs mt-1">
                          calls {s.totalUses ?? 0} · revenue {(s.totalRevenue ?? 0).toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => togglePause(s, !s.isPaused)}
                        className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low"
                      >
                        {s.isPaused ? "Resume" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeService(s)}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-800 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="tonal-separator my-10" />

            <h2 className="font-headline text-lg font-semibold text-primary mb-4">Call log</h2>
            {usage.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No proxy calls yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {usage.map((row) => (
                  <li
                    key={row.id}
                    className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-col sm:flex-row sm:justify-between gap-1"
                  >
                    <span>
                      {row.serviceTitle} ·{" "}
                      <span className="font-mono text-xs">{row.userWallet?.slice(0, 12)}…</span>
                    </span>
                    <span className="font-mono">{Number(row.amountAlgo).toFixed(4)} ALGO</span>
                    <span className="text-xs text-on-surface-variant">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
