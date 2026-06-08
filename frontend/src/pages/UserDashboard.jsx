import React from "react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserDashboard() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentJson, setAgentJson] = useState(null);
  const [agentCopied, setAgentCopied] = useState(false);
  const [gatewayData, setGatewayData] = useState(null);
  const [profileData, setProfileData] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const requests = [
        api.get("/api/user/proxy-keys"),
        api.get("/api/user/usage?limit=50"),
        api.get("/api/services/agent-context"),
      ];

      // Fetch gateway consumer dashboard (may fail if not set up)
      requests.push(
        api.get("/api/gateway/consumer/dashboard").catch(() => ({ data: null }))
      );
      // Fetch profile summary (may fail)
      requests.push(
        api.get("/api/profile/summary").catch(() => ({ data: null }))
      );

      const [k, u, ctx, gw, profile] = await Promise.all(requests);
      setKeys(k.data ?? []);
      setUsage(u.data ?? []);
      setAgentJson(ctx.data ?? null);
      setGatewayData(gw.data ?? null);
      setProfileData(profile.data ?? null);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const copyAgentJson = useCallback(async () => {
    if (!agentJson) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(agentJson, null, 2));
      setAgentCopied(true);
      toast.success("Agent context copied to clipboard!");
      setTimeout(() => setAgentCopied(false), 2500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [agentJson]);

  const downloadAgentJson = useCallback(() => {
    if (!agentJson) return;
    const blob = new Blob([JSON.stringify(agentJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-agent-context-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded sentinel-agent-context.json");
  }, [agentJson]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  // Unified stats from both gateway + legacy
  const gw = gatewayData || {};
  const profile = profileData || {};
  const gwSummary = profile.gatewaySummary || {};
  const userSummary = profile.userSummary || {};

  const totalApiCalls = (gw.totals?.apiCalls || 0) || (gwSummary.totalCalls || 0) + (userSummary.totalCalls || 0);
  const totalTokens = (gw.totals?.tokens || 0) || (gwSummary.totalTokens || 0) + (userSummary.totalTokens || 0);
  const balanceCents = gw.balanceCents ?? gwSummary.balanceCents ?? 0;
  const balanceAlgo = gw.balanceAlgo ?? gwSummary.balanceAlgo ?? 0;
  const rate = gw.rate || 35;

  // Merge recent logs from gateway
  const recentLogs = gw.recentLogs || gwSummary.recentLogs || [];
  const subscriptions = gw.subscriptions || gwSummary.subscriptions || [];

  return (
    <div className="pt-4 pb-8 w-full">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Marketplace Home</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        API economy and infrastructure overview for developer workflows.
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Identity</p>
          <p className="text-sm mt-1 font-semibold text-primary">{user?.displayName || "User"}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Gateway Balance</p>
          <p className="text-sm mt-1 font-mono text-primary">
            {balanceCents > 0 ? `${balanceAlgo.toFixed(4)} ALGO` : user?.walletAddress ? "0 ALGO" : "No wallet"}
          </p>
          {balanceCents > 0 && (
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">${(balanceCents / 100).toFixed(2)}</p>
          )}
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Total API Calls</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{totalApiCalls}</p>
          {gw.totals?.legacyCalls > 0 && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              {gw.totals.gatewayCalls} gateway · {gw.totals.legacyCalls} legacy
            </p>
          )}
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Tokens Used</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Active Subscriptions</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{subscriptions.length}</p>
        </div>
      </section>

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Quick Actions</h2>
            <div className="grid gap-2 text-sm">
              <Link to="/marketplace/browse" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Browse APIs
              </Link>
              <Link to="/dashboard/creators" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                View Creators
              </Link>
              <Link to="/docs/how-it-works" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                How It Works
              </Link>
              <Link to="/dashboard/usage" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Open Usage Analytics
              </Link>
              <Link to="/dashboard/contract" className="border border-[#e2e8f0] rounded-md px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between text-indigo-600 font-semibold">
                <span>On-Chain Smart Contract</span>
                <span className="material-symbols-outlined text-[16px]">gavel</span>
              </Link>
              <Link to="/creator/new" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Create Endpoint
              </Link>
            </div>
          </section>

          <section id="usage" className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Unified API Activity</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Total API calls</span>
                <span className="font-mono">{totalApiCalls}</span>
              </li>
              <li className="flex justify-between">
                <span>Gateway balance</span>
                <span className="font-mono">{balanceAlgo.toFixed(4)} ALGO</span>
              </li>
              <li className="flex justify-between">
                <span>Legacy ALGO spent</span>
                <span className="font-mono">
                  {(gw.totals?.legacySpentAlgo || userSummary.totalSpent || 0).toFixed(4)} ALGO
                </span>
              </li>
              <li className="flex justify-between">
                <span>Gateway spent (this month)</span>
                <span className="font-mono">
                  {((gw.period?.spendAlgo?.month || 0)).toFixed(4)} ALGO
                </span>
              </li>
              <li className="flex justify-between">
                <span>Active endpoints</span>
                <span className="font-mono">{keys.length}</span>
              </li>
            </ul>
          </section>

          <section className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Infrastructure</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Active subscriptions</span>
                <span className="font-mono">{subscriptions.length}</span>
              </li>
              <li className="flex justify-between">
                <span>Gateway system</span>
                <span className="text-on-surface-variant">{gw.balanceCents != null ? "Connected" : "Not connected"}</span>
              </li>
              <li className="flex justify-between">
                <span>Legacy system</span>
                <span className="text-on-surface-variant">{user?.walletAddress ? "Connected" : "No wallet"}</span>
              </li>
              <li className="flex justify-between">
                <span>Low balance alert</span>
                <span className={gw.lowBalance ? "text-amber-600 font-semibold" : "text-on-surface-variant"}>
                  {gw.lowBalance ? "⚠ Low balance" : "OK"}
                </span>
              </li>
            </ul>
          </section>

          {/* Subscriptions */}
          {subscriptions.length > 0 && (
            <section className="lg:col-span-3 bg-white border border-surface-variant rounded-md p-5">
              <h2 className="font-semibold text-primary mb-4">Gateway Subscriptions</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="bg-white border border-surface-variant rounded-md p-4 text-sm">
                    <p className="font-semibold">{sub.apiName || "API"}</p>
                    <p className="text-on-surface-variant text-xs mt-1">
                      {sub.pricingModel} · {sub.pricePerUnitAlgo?.toFixed(6) || "?"} ALGO/unit
                    </p>
                    {sub.proxyUrl && (
                      <p className="font-mono text-xs break-all mt-2 text-primary">{sub.proxyUrl}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Legacy API Keys */}
          <section id="keys" className="lg:col-span-2 bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">My API Keys</h2>
            {keys.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No keys yet. Open a service in the marketplace and generate one.
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((row) => (
                  <div key={row.id} className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1">
                    <p className="font-semibold">{row.service?.title ?? "Service"}</p>
                    <p className="text-on-surface-variant text-xs">
                      {row.service?.aiProvider} · {row.service?.modelName} ·{" "}
                      {Number(row.service?.pricePerThousandTokens ?? 0).toFixed(6)} ALGO/1k tok · min{" "}
                      {Number(row.service?.minimumChargeAlgo ?? 0).toFixed(6)} ALGO
                    </p>
                    <p className="font-mono text-xs break-all mt-2">{row.key}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Activity (unified) */}
          <section className="bg-white border border-surface-variant rounded-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Recent API Activity</h2>
              {recentLogs.length > 0 && (
                <span className="text-xs text-on-surface-variant">{recentLogs.length} call{recentLogs.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {recentLogs.length === 0 && usage.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No API calls recorded yet.</p>
            ) : (
              <div className="relative">
                <ul
                  className="space-y-2 text-sm overflow-y-auto pr-1"
                  style={{
                    maxHeight: '320px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#c5c6cf transparent',
                  }}
                >
                  {(recentLogs.length > 0 ? recentLogs : usage).map((row) => (
                    <li
                      key={row.id || row.requestId}
                      className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-wrap justify-between gap-2 items-center"
                    >
                      <span className="text-on-surface-variant">
                        {row.apiName || row.serviceTitle || "—"}
                        {row.source && (
                          <span className={`ml-1 text-[9px] px-1 py-0.5 rounded ${
                            row.source === "gateway" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {row.source}
                          </span>
                        )}
                      </span>
                      <span
                        className={
                          (row.requestStatus === "failed" || row.success === false)
                            ? "text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900"
                            : "text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                        }
                      >
                        {row.requestStatus === "failed" || row.success === false ? "Failed" : "Completed"}
                      </span>
                      <span className="font-mono shrink-0 text-xs">
                        {row.costAlgo != null
                          ? `${Number(row.costAlgo).toFixed(6)} ALGO`
                          : row.amountAlgo != null
                            ? `${Number(row.amountAlgo).toFixed(6)} ALGO`
                            : `${row.costCents || 0}¢`
                        }
                        {(row.tokensTotal || row.totalTokens) != null ? ` · ${row.tokensTotal || row.totalTokens} tok` : ""}
                      </span>
                      {row.responseTimeMs && (
                        <span className="text-xs text-on-surface-variant">{row.responseTimeMs}ms</span>
                      )}
                      {(row.paymentTxId) && (
                        <a
                          href={`https://testnet.algoexplorer.io/tx/${row.paymentTxId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-secondary underline font-mono"
                        >
                          Tx
                        </a>
                      )}
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {(row.timestamp || row.createdAt) ? new Date(row.timestamp || row.createdAt).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {(recentLogs.length > 3 || usage.length > 3) && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-md"
                    style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Agent Context JSON Panel */}
      <section className="mt-6 bg-white border border-surface-variant rounded-md p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-primary">Agent Context JSON</h2>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xl">
              Paste this JSON into any AI assistant (Claude, ChatGPT, Gemini, etc.) to let it
              browse the live Sentinal API catalog and recommend the best service for your use-case.
              The file updates automatically whenever APIs are added or changed.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              id="copy-agent-context"
              onClick={copyAgentJson}
              disabled={!agentJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-outline-variant hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              {agentCopied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy JSON
                </>
              )}
            </button>
            <button
              id="download-agent-context"
              onClick={downloadAgentJson}
              disabled={!agentJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download .json
            </button>
          </div>
        </div>

        {/* Live summary pills */}
        {agentJson && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {agentJson.total_active_services} active services
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {agentJson.network}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Generated {agentJson.generated_at ? new Date(agentJson.generated_at).toLocaleTimeString() : ""}
            </span>
          </div>
        )}

        {/* JSON preview */}
        <pre
          id="agent-context-preview"
          className="bg-slate-50 border border-surface-variant rounded-md p-3 text-xs font-mono overflow-auto max-h-64 text-slate-700 whitespace-pre-wrap"
        >
          {agentJson
            ? JSON.stringify(agentJson, null, 2)
            : loading
              ? "Loading agent context…"
              : "No active services found."}
        </pre>

        <p className="text-xs text-on-surface-variant mt-2">
          <span className="font-medium">Tip:</span> Say to your AI:{" "}
          <span className="italic text-slate-600">
            "Here is the Sentinal marketplace JSON. Which service should I use for [your task]?"
          </span>
        </p>
      </section>
    </div>
  );
}
