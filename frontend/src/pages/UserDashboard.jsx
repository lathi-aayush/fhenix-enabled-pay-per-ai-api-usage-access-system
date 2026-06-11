import React from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { testnetTxUrl } from "../utils/explorer.js";

export default function UserDashboard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const keysOnly = pathname === "/dashboard/keys";
  const [keys, setKeys] = useState([]);
  const [publishedEndpoints, setPublishedEndpoints] = useState([]);
  const [gatewayKeys, setGatewayKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentJson, setAgentJson] = useState(null);
  const [agentCopied, setAgentCopied] = useState(false);
  const [gatewayData, setGatewayData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [txSummary, setTxSummary] = useState(null);
  const [txItems, setTxItems] = useState([]);
  const [walletBalanceAlgo, setWalletBalanceAlgo] = useState(null);
  const [creatorStats, setCreatorStats] = useState(null);

  const applyKeysPayload = useCallback((data) => {
    if (Array.isArray(data)) {
      setKeys(data);
      setPublishedEndpoints([]);
      setGatewayKeys([]);
      return;
    }
    setKeys(data?.consumerKeys ?? []);
    setPublishedEndpoints(data?.publishedEndpoints ?? []);
    const gateway = [...(data?.gatewaySubscriptions ?? [])];
    if (data?.gatewayMasterKey?.key) {
      gateway.unshift(data.gatewayMasterKey);
    }
    setGatewayKeys(gateway);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (keysOnly) {
        const { data } = await api.get("/api/user/proxy-keys");
        applyKeysPayload(data);
        return;
      }

      const requests = [
        api.get("/api/user/proxy-keys"),
        api.get("/api/user/usage?limit=50"),
        api.get("/api/services/agent-context"),
        api.get("/api/user/transactions?limit=500").catch(() => ({
          data: { items: [], summary: { totalCalls: 0, totalTokensConsumed: 0, totalAlgoSpent: 0 } },
        })),
        api.get("/api/user/algo-balance").catch(() => ({ data: null })),
        api.get("/api/gateway/consumer/dashboard").catch(() => ({ data: null })),
        api.get("/api/profile/summary").catch(() => ({ data: null })),
      ];

      if (user?.role === "creator") {
        requests.push(api.get("/api/creator/stats").catch(() => ({ data: null })));
      }

      const results = await Promise.all(requests);
      const [k, u, ctx, tx, bal, gw, profile, creator] = results;

      applyKeysPayload(k.data);
      setUsage(u.data ?? []);
      setAgentJson(ctx.data ?? null);
      setTxSummary(tx.data?.summary ?? null);
      setTxItems(tx.data?.items ?? []);
      setWalletBalanceAlgo(bal.data?.balanceAlgo ?? null);
      setGatewayData(gw.data ?? null);
      setProfileData(profile.data ?? null);
      setCreatorStats(creator?.data ?? null);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.role, keysOnly, applyKeysPayload]);

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

  const gw = gatewayData || {};
  const profile = profileData || {};
  const gwSummary = profile.gatewaySummary || {};
  const userSummary = profile.userSummary || {};
  const creatorSummary = creatorStats || profile.creatorSummary || {};

  const consumerCalls = Math.max(
    gw.totals?.apiCalls ?? 0,
    (gwSummary.totalCalls ?? 0) + (userSummary.totalCalls ?? 0),
    txSummary?.totalCalls ?? 0
  );
  const consumerTokens = Math.max(
    gw.totals?.tokens ?? 0,
    (gwSummary.totalTokens ?? 0) + (userSummary.totalTokens ?? 0),
    txSummary?.totalTokensConsumed ?? 0
  );

  const onChainBalance = walletBalanceAlgo;
  const gatewayPrepaidCents = gw.balanceCents ?? gwSummary.balanceCents ?? 0;
  const gatewayPrepaidAlgo = gw.balanceAlgo ?? gwSummary.balanceAlgo ?? 0;

  const recentLogs = gw.recentLogs?.length
    ? gw.recentLogs
    : gwSummary.recentLogs?.length
      ? gwSummary.recentLogs
      : userSummary.recentCalls?.length
        ? userSummary.recentCalls.map((row) => ({
            id: row.id,
            apiName: row.serviceTitle,
            timestamp: row.createdAt,
            costAlgo: row.amountAlgo,
            tokensTotal: row.totalTokens,
            requestStatus: row.success === false ? "failed" : "success",
            source: "legacy",
            paymentTxId: row.paymentTxId,
          }))
        : txItems.length
          ? txItems.map((row) => ({
              id: row.id,
              apiName: row.serviceTitle,
              timestamp: row.createdAt,
              costAlgo: row.amountAlgo ?? row.chargeAlgo,
              tokensTotal: row.totalTokens,
              requestStatus: row.success === false ? "failed" : "success",
              source: "legacy",
              paymentTxId: row.paymentTxId,
            }))
          : (profile.creatorSummary?.recentSales || []).map((row) => ({
              id: row.id,
              apiName: row.serviceTitle,
              timestamp: row.createdAt,
              costAlgo: row.amountAlgo,
              tokensTotal: row.totalTokens,
              requestStatus: row.success === false ? "failed" : "success",
              source: "creator",
              paymentTxId: row.paymentTxId,
            }));

  const subscriptions = gw.subscriptions?.length
    ? gw.subscriptions
    : gwSummary.subscriptions || [];
  const isCreator = user?.role === "creator";

  const hasAnyKeys =
    keys.length > 0 || publishedEndpoints.length > 0 || gatewayKeys.length > 0;

  const keysPanel = (
    <div className="space-y-6">
      {publishedEndpoints.length > 0 && (
        <section className="bg-white border border-surface-variant rounded-md p-5">
          <h2 className="font-semibold text-primary mb-1">Published endpoints</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            APIs you listed on the marketplace as a creator.
          </p>
          <div className="space-y-3">
            {publishedEndpoints.map((row) => (
              <div
                key={row.id}
                className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold">{row.name}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    Your listing
                  </span>
                </div>
                <p className="text-on-surface-variant text-xs">
                  {row.aiProvider} · {row.modelName || "model"} ·{" "}
                  {Number(row.pricePerUnitAlgo ?? 0).toFixed(6)} ALGO · {row.callCount ?? 0} calls
                </p>
                <p className="font-mono text-xs break-all mt-2 text-primary">{row.proxyUrl}</p>
                {row.legacyServiceId && (
                  <Link
                    to={`/marketplace/services/${row.legacyServiceId}`}
                    className="text-xs text-secondary hover:underline mt-1 w-fit"
                  >
                    View marketplace listing →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="keys" className="bg-white border border-surface-variant rounded-md p-5">
        <h2 className="font-semibold text-primary mb-1">Proxy API keys</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          Keys you generated to call marketplace services
          {user?.walletAddress ? "" : " — connect a wallet to generate keys"}.
        </p>
        {loading ? (
          <p className="text-sm text-on-surface-variant">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No proxy keys yet. Open a service in the marketplace and generate one.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map((row) => (
              <div
                key={row.id}
                className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1"
              >
                <p className="font-semibold">{row.service?.title ?? "Service"}</p>
                <p className="text-on-surface-variant text-xs">
                  {row.service?.aiProvider} · {row.service?.modelName} ·{" "}
                  {Number(row.service?.pricePerThousandTokens ?? 0).toFixed(6)} ALGO/1k tok · min{" "}
                  {Number(row.service?.minimumChargeAlgo ?? 0).toFixed(6)} ALGO
                </p>
                <p className="font-mono text-xs break-all mt-2">{row.key}</p>
                {row.createdAt && (
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    Created {new Date(row.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {gatewayKeys.length > 0 && (
        <section className="bg-white border border-surface-variant rounded-md p-5">
          <h2 className="font-semibold text-primary mb-1">Gateway keys</h2>
          <p className="text-sm text-on-surface-variant mb-4">Keys for the API gateway proxy.</p>
          <div className="space-y-3">
            {gatewayKeys.map((row, idx) => (
              <div
                key={row.id ?? `gw-${idx}`}
                className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1"
              >
                <p className="font-semibold">{row.apiName || row.label || "Gateway key"}</p>
                {row.proxyUrl && (
                  <p className="font-mono text-xs break-all text-on-surface-variant">{row.proxyUrl}</p>
                )}
                <p className="font-mono text-xs break-all mt-2">{row.key}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && !hasAnyKeys && (
        <p className="text-sm text-on-surface-variant text-center py-4">
          No keys or endpoints linked to your account yet.
        </p>
      )}
    </div>
  );

  if (keysOnly) {
    return (
      <div className="pt-4 pb-8 w-full">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">My Keys</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Your marketplace proxy keys and published API endpoints.
        </p>
        {keysPanel}
      </div>
    );
  }

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
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Wallet Balance</p>
          <p className="text-sm mt-1 font-mono text-primary">
            {!user?.walletAddress
              ? "No wallet"
              : onChainBalance != null
                ? `${onChainBalance.toFixed(4)} ALGO`
                : loading
                  ? "…"
                  : "—"}
          </p>
          {gatewayPrepaidCents > 0 && (
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              + {gatewayPrepaidAlgo.toFixed(4)} ALGO prepaid
            </p>
          )}
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Your API Calls</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{consumerCalls}</p>
          {gw.totals?.legacyCalls > 0 && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              {gw.totals.gatewayCalls} gateway · {gw.totals.legacyCalls} legacy
            </p>
          )}
          {isCreator && (creatorSummary.totalUses ?? creatorStats?.totalUses) > 0 && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              {creatorSummary.totalUses ?? creatorStats?.totalUses} on your endpoints
            </p>
          )}
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Tokens Used</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{consumerTokens.toLocaleString()}</p>
          {isCreator && (creatorSummary.totalTokensServed ?? creatorStats?.totalTokensServed) > 0 && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              {(creatorSummary.totalTokensServed ?? creatorStats?.totalTokensServed).toLocaleString()} served on your APIs
            </p>
          )}
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">
            {isCreator ? "Creator Revenue" : "Active Subscriptions"}
          </p>
          {isCreator ? (
            <>
              <p className="text-2xl font-headline font-semibold text-primary mt-1 font-mono">
                {(creatorSummary.totalRevenue ?? creatorStats?.totalRevenue ?? 0).toFixed(4)} ALGO
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {creatorSummary.serviceCount ?? creatorStats?.serviceCount ?? 0} published endpoint
                {(creatorSummary.serviceCount ?? creatorStats?.serviceCount ?? 0) === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <p className="text-2xl font-headline font-semibold text-primary mt-1">{subscriptions.length}</p>
          )}
        </div>
      </section>

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section id="usage" className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Unified API Activity</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Your API calls</span>
                <span className="font-mono">{consumerCalls}</span>
              </li>
              <li className="flex justify-between">
                <span>On-chain wallet</span>
                <span className="font-mono">
                  {onChainBalance != null ? `${onChainBalance.toFixed(4)} ALGO` : "—"}
                </span>
              </li>
              {isCreator && (
                <li className="flex justify-between">
                  <span>Creator revenue</span>
                  <span className="font-mono">
                    {(creatorSummary.totalRevenue ?? creatorStats?.totalRevenue ?? 0).toFixed(4)} ALGO
                  </span>
                </li>
              )}
              <li className="flex justify-between">
                <span>Active endpoints</span>
                <span className="font-mono">
                  {isCreator
                    ? creatorSummary.serviceCount ?? creatorStats?.serviceCount ?? keys.length
                    : keys.length}
                </span>
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
                <span
                  className={
                    gw.lowBalance || (onChainBalance != null && onChainBalance < 0.5)
                      ? "text-amber-600 font-semibold"
                      : "text-on-surface-variant"
                  }
                >
                  {gw.lowBalance || (onChainBalance != null && onChainBalance < 0.5)
                    ? "⚠ Low balance"
                    : "OK"}
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
          <div className="lg:col-span-2">{keysPanel}</div>

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
                          href={testnetTxUrl(row.paymentTxId)}
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
