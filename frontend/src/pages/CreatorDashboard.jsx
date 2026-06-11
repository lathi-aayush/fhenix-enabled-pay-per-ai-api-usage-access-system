import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getPublicApiBase } from "../utils/apiBase.js";
import MegaNav from "../components/MegaNav.jsx";
import { testnetTxUrl } from "../utils/explorer.js";
import { motion, AnimatePresence } from "framer-motion";

export default function CreatorDashboard() {
  const { user, becomeCreator } = useAuth();
  const [activeTab, setActiveTab] = useState("endpoints");
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [withdrawalData, setWithdrawalData] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [newSecret, setNewSecret] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gwData, setGwData] = useState(null);

  const apiBase = getPublicApiBase();
  const proxyExample = `${apiBase}/api/use`;

  const getProviderBadge = (provider) => {
    const p = (provider || "").toLowerCase();
    if (p.includes("openai")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (p.includes("anthropic")) return "text-amber-700 bg-amber-50 border-amber-200";
    if (p.includes("deepseek")) return "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200";
    if (p.includes("groq")) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-slate-600 bg-slate-50 border-slate-200";
  };

  async function load() {
    try {
      const [{ data: s }, { data: u }, { data: wh }, { data: del }, { data: wd }] = await Promise.all([
        api.get("/api/creator/stats"),
        api.get("/api/creator/usage?limit=40"),
        api.get("/api/creator/webhooks"),
        api.get("/api/creator/webhooks/deliveries?limit=20"),
        api.get("/api/creator/withdrawals"),
      ]);
      setStats(s);
      setUsage(u ?? []);
      setWebhooks(wh ?? []);
      setDeliveries(del ?? []);
      setWithdrawalData(wd);

      // Fetch gateway developer dashboard (best-effort)
      try {
        const { data: gw } = await api.get("/api/gateway/developer/dashboard");
        setGwData(gw);
      } catch {
        // Gateway data is optional
      }
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (user?.role !== "creator") {
          await becomeCreator();
        }
        if (!cancelled) await load();
      } catch (e) {
        if (!cancelled) {
          const msg =
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            "Sign in as Creator from the home page (Connect as Creator).";
          toast.error(msg);
          setLoading(false);
        }
      }
    }
    if (user) init();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

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

  async function toggleX402(svc, nextX402) {
    try {
      await api.patch(`/api/services/${svc._id}`, { x402Enabled: nextX402 });
      toast.success(nextX402 ? "x402 enabled" : "x402 disabled");
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

  async function addWebhook(e) {
    e.preventDefault();
    const url = webhookUrl.trim();
    if (!url) {
      toast.error("Enter a webhook URL");
      return;
    }
    try {
      const { data } = await api.post("/api/creator/webhooks", {
        url,
        description: webhookDesc.trim(),
      });
      setNewSecret(data.secret);
      setWebhookUrl("");
      setWebhookDesc("");
      toast.success("Webhook registered");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not add webhook");
    }
  }

  async function toggleWebhookEnabled(wh, enabled) {
    try {
      await api.patch(`/api/creator/webhooks/${wh.id}`, { enabled });
      toast.success(enabled ? "Webhook enabled" : "Webhook paused");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    }
  }

  async function testWebhook(wh) {
    try {
      const { data } = await api.post(`/api/creator/webhooks/${wh.id}/test`);
      if (data.success) {
        toast.success(`Test delivered (HTTP ${data.httpStatus})`);
      } else {
        toast.error(data.errorMessage || `Test failed (HTTP ${data.httpStatus ?? "—"})`);
      }
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Test failed");
    }
  }

  async function deleteWebhook(wh) {
    if (!window.confirm(`Remove webhook for ${wh.url}?`)) return;
    try {
      await api.delete(`/api/creator/webhooks/${wh.id}`);
      toast.success("Webhook removed");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  }

  function copySecret() {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret).then(
      () => toast.success("Secret copied"),
      () => toast.error("Could not copy")
    );
  }

  async function submitWithdrawal(e) {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid ALGO amount");
      return;
    }
    const min = withdrawalData?.minWithdrawalAlgo ?? 0.1;
    if (amount < min) {
      toast.error(`Minimum withdrawal is ${min} ALGO`);
      return;
    }
    if (amount > (withdrawalData?.withdrawable ?? 0)) {
      toast.error("Amount exceeds withdrawable balance");
      return;
    }

    setWithdrawing(true);
    try {
      const { data } = await api.post("/api/creator/withdraw", { amount });
      setWithdrawalData((prev) => ({
        ...prev,
        totalEarned: data.totalEarned,
        totalWithdrawn: data.totalWithdrawn,
        withdrawable: data.withdrawable,
        pendingWithdrawals: data.pendingWithdrawals,
        withdrawals: [data.withdrawal, ...(prev?.withdrawals ?? [])],
      }));
      setWithdrawAmount("");
      toast.success(`Withdrawal sent — ${data.withdrawal.txId?.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Withdrawal failed");
      try {
        const { data } = await api.get("/api/creator/withdrawals");
        setWithdrawalData(data);
      } catch {
        /* ignore refresh failure */
      }
    } finally {
      setWithdrawing(false);
    }
  }

  const tabs = [
    { id: "endpoints", label: "Endpoints & Analytics" },
    { id: "webhooks", label: "Webhooks & Events" },
    { id: "withdrawals", label: "Earnings & Payouts" },
    { id: "contract", label: "Smart Contract Stats", href: "/dashboard/contract" },
  ];

  return (
    <div className="bg-[#fafafc] selection:bg-indigo-50 selection:text-indigo-900 min-h-screen relative overflow-hidden font-body text-slate-800 antialiased">
      <MegaNav />

      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg className="absolute inset-0 w-full h-full stroke-slate-200/30 [mask-image:linear-gradient(to_bottom,white_20%,transparent_90%)]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern-full" width="40" height="40" patternUnits="userSpaceOnUse" x="50%" y="-1">
              <path d="M.5 40V.5H40" fill="none" strokeDasharray="3 3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern-full)" />
        </svg>
        <div className="absolute top-[-10%] left-[-15%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-indigo-300/[0.08] blur-[120px] animate-blob" />
        <div className="absolute top-[40%] right-[-10%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-fuchsia-300/[0.06] blur-[130px] animate-blob animation-delay-2000" />
      </div>

      <main className="pt-20 px-6 max-w-4xl mx-auto pb-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Creator Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === "endpoints" && "Deploy, manage, and monitor your AI endpoints"}
              {activeTab === "webhooks" && "Configure notifications for paid execution events"}
              {activeTab === "withdrawals" && "Withdraw your Algorand revenue instantly"}
            </p>
          </div>
          {activeTab === "endpoints" && (
            <Link
              to="/creator/new"
              className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white px-5 py-2.5 rounded-full text-xs font-bold hover:shadow-lg hover:shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-500 transition-all duration-300"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Endpoint
            </Link>
          )}
        </div>

        <div className="flex gap-2 p-1 mb-8 bg-slate-200/40 backdrop-blur-md rounded-xl w-fit border border-slate-200/40">
          {tabs.map((tab) =>
            tab.href ? (
              <Link
                key={tab.id}
                to={tab.href}
                className="relative px-4 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-white/60 transition-all"
              >
                {tab.label}
              </Link>
            ) : (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
            <span className="inline-block h-5 w-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-sm font-semibold">Loading dashboard…</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activeTab === "endpoints" && (
                <>
                  {/* Combined stats from legacy + gateway */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    {[
                      { label: "Total revenue", value: gwData?.totals?.totalRevenueAlgo != null ? `${gwData.totals.totalRevenueAlgo.toFixed(4)} ALGO` : `${(stats?.totalRevenue ?? 0).toFixed(4)} ALGO`, icon: "payments", color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
                      { label: "Tokens served", value: ((stats?.totalTokensServed ?? 0) + (gwData?.totals?.legacyTokensServed ?? 0)).toLocaleString(), icon: "generating_tokens", color: "text-indigo-500 bg-indigo-50 border-indigo-100" },
                      { label: "Total calls", value: gwData?.totals?.totalCalls ?? stats?.totalUses ?? 0, icon: "api", color: "text-violet-500 bg-violet-50 border-violet-100" },
                      { label: "Endpoints", value: (stats?.serviceCount ?? 0) + (gwData?.apis?.length ?? 0), icon: "terminal", color: "text-amber-500 bg-amber-50 border-amber-100" },
                    ].map((s, idx) => (
                      <div key={idx} className="bg-white/70 backdrop-blur-md border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-300">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{s.label}</span>
                          <span className={`material-symbols-outlined text-[18px] p-1.5 rounded-lg border ${s.color}`}>{s.icon}</span>
                        </div>
                        <p className="font-headline text-2xl font-extrabold text-slate-900 mt-3">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Gateway earnings breakdown */}
                  {gwData?.earnings && (
                    <div className="bg-gradient-to-r from-indigo-50/50 to-violet-50/50 backdrop-blur-md border border-indigo-200/40 rounded-2xl p-4 mb-4 flex flex-wrap gap-6 items-center text-xs">
                      <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">Gateway Earnings</span>
                      <span className="text-slate-600">Available: <span className="font-mono font-bold text-emerald-600">{(gwData.earnings.availableAlgo || 0).toFixed(4)} ALGO</span></span>
                      <span className="text-slate-600">Pending: <span className="font-mono font-bold text-amber-600">{(gwData.earnings.pendingAlgo || 0).toFixed(4)} ALGO</span></span>
                      <span className="text-slate-600">Paid out: <span className="font-mono font-bold text-slate-700">{(gwData.earnings.paidOutAlgo || 0).toFixed(4)} ALGO</span></span>
                      <span className="text-slate-600">Consumers: <span className="font-mono font-bold">{gwData.activeConsumers || 0}</span></span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" style={{ display: 'none' }}>
                    {[
                      { label: "Total revenue", value: `${(stats?.totalRevenue ?? 0).toFixed(4)} ALGO`, icon: "payments", color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
                      { label: "Tokens served", value: (stats?.totalTokensServed ?? 0).toLocaleString(), icon: "generating_tokens", color: "text-indigo-500 bg-indigo-50 border-indigo-100" },
                      { label: "Total calls", value: stats?.totalUses ?? 0, icon: "api", color: "text-violet-500 bg-violet-50 border-violet-100" },
                      { label: "Endpoints", value: stats?.serviceCount ?? 0, icon: "terminal", color: "text-amber-500 bg-amber-50 border-amber-100" },
                    ].map((s, idx) => (
                      <div key={idx} className="bg-white/70 backdrop-blur-md border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-300">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{s.label}</span>
                          <span className={`material-symbols-outlined text-[18px] p-1.5 rounded-lg border ${s.color}`}>{s.icon}</span>
                        </div>
                        <p className="font-headline text-2xl font-extrabold text-slate-900 mt-3">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 mb-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md">User-Facing Proxy URL</span>
                      <p className="font-mono text-xs break-all text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 select-all font-bold">{proxyExample}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(proxyExample);
                        toast.success("Proxy URL copied!");
                      }}
                      className="shrink-0 inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                      Copy URL
                    </button>
                  </div>

                  <h2 className="font-headline text-lg font-bold text-slate-900 mb-4">Your endpoints</h2>
                  {services.length === 0 ? (
                    <div className="bg-white/50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
                      No endpoints yet. Add one to list on the marketplace.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {services.map((s) => (
                        <div
                          key={s._id}
                          className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-slate-300/90 transition-all duration-300"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-headline font-bold text-slate-900 text-lg leading-snug">{s.title}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getProviderBadge(s.aiProvider)}`}>
                                  {s.aiProvider || "Custom"}
                                </span>
                                {s.isPaused && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                                    Paused
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-slate-400 mt-1 font-semibold">
                                Model: {s.modelName || "Standard"}
                              </p>
                              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{s.description}</p>
                            </div>

                            <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-3.5 sm:text-right shrink-0 flex flex-col gap-1 shadow-inner">
                              <p className="text-indigo-600 font-mono text-xs font-bold">
                                {Number(s.pricePerThousandTokens ?? 0).toFixed(6)} ALGO / 1k tokens
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                min/call: {Number(s.minimumChargeAlgo ?? 0).toFixed(6)} ALGO
                              </p>
                              <div className="h-px bg-slate-200/50 my-1.5" />
                              <p className="text-[10px] text-slate-500 font-semibold">
                                calls: <span className="text-slate-800 font-mono font-bold">{s.logCalls ?? 0}</span> · earned: <span className="text-emerald-600 font-mono font-bold">{(s.logEarnedAlgo ?? 0).toFixed(4)} ALGO</span>
                              </p>
                              <p className="text-[9px] text-slate-400">
                                served: <span className="font-mono">{(s.logTokensServed ?? 0).toLocaleString()}</span> tokens
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2.5 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => togglePause(s, !s.isPaused)}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                s.isPaused 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{s.isPaused ? "play_arrow" : "pause"}</span>
                              {s.isPaused ? "Resume Service" : "Pause Service"}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleX402(s, !s.x402Enabled)}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                s.x402Enabled 
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" 
                                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{s.x402Enabled ? "verified" : "lock_open"}</span>
                              {s.x402Enabled ? "x402 Gate: Active" : "x402 Gate: Inactive"}
                            </button>

                            <button
                              type="button"
                              onClick={() => removeService(s)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 ml-auto transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h2 className="font-headline text-lg font-bold text-slate-900 mb-4 mt-10">Call log</h2>
                  {usage.length === 0 ? (
                    <div className="bg-white/50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
                      No proxy calls yet. Customer paid API calls will show up here.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {usage.map((row) => (
                        <li
                          key={row.id}
                          className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-slate-300 transition-all duration-300"
                        >
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <span className="text-sm font-semibold text-slate-800">
                              {row.serviceTitle} <span className="text-slate-300">·</span> <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">{row.userWallet?.slice(0, 12)}…</span>
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                row.success === false
                                  ? "bg-amber-50 border-amber-200 text-amber-900"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                              }`}
                            >
                              {row.success === false ? "Paid on-chain · AI failed" : "Completed"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100/50">
                            <span className="font-mono text-indigo-600 font-bold">
                              charge: {Number(row.chargeAlgo ?? row.amountAlgo).toFixed(6)} ALGO
                            </span>
                            <span>
                              tokens in/out: <span className="font-semibold text-slate-600">{row.promptTokens ?? "—"}</span>/<span className="font-semibold text-slate-600">{row.completionTokens ?? "—"}</span> (Σ <span className="font-semibold text-slate-600">{row.totalTokens ?? "—"}</span>)
                            </span>
                            <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</span>
                            {(row.paymentTxId || row.payoutTxId) && (
                              <a
                                href={testnetTxUrl(row.paymentTxId || row.payoutTxId)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-slate-500 hover:text-indigo-600 transition-colors font-mono font-bold"
                              >
                                Tx Details
                                <span className="material-symbols-outlined text-[13px]">arrow_outward</span>
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {activeTab === "webhooks" && (
                <>
                  <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 mb-8 shadow-sm">
                    <h2 className="font-headline text-lg font-bold text-slate-900 mb-1">Webhooks Configuration</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Sentinal can send HTTP POST notifications to your server whenever a customer completes a paid API call.
                      Verify requests with the <span className="font-mono text-[10px] bg-slate-100 border border-slate-200/50 px-1 rounded font-bold text-indigo-600">X-Sentinel-Signature</span> HMAC SHA256 header.
                    </p>
                  </div>

                  {newSecret && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                      <p className="font-bold text-amber-900 text-sm mb-1">Save your signing secret — shown once!</p>
                      <p className="font-mono text-xs break-all text-amber-950 bg-white/60 p-2.5 rounded-lg border border-amber-200/50 select-all font-bold">{newSecret}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={copySecret}
                          className="text-xs px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 font-bold transition-all cursor-pointer"
                        >
                          Copy secret
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSecret(null)}
                          className="text-xs px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 font-bold transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={addWebhook} className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 mb-8 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">Register New Webhook</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Endpoint URL</label>
                        <input
                          type="url"
                          required
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://your-server.com/webhooks/sentinel"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Label (optional)</label>
                        <input
                          type="text"
                          value={webhookDesc}
                          onChange={(e) => setWebhookDesc(e.target.value)}
                          placeholder="e.g. Production hook"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all duration-200 shadow-sm cursor-pointer"
                    >
                      Add webhook
                    </button>
                  </form>

                  <h2 className="font-headline text-lg font-bold text-slate-900 mb-4">Active webhooks</h2>
                  {webhooks.length === 0 ? (
                    <div className="bg-white/50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
                      No webhooks configured yet. Add one above to start receiving alerts.
                    </div>
                  ) : (
                    <div className="space-y-3 mb-8">
                      {webhooks.map((wh) => (
                        <div key={wh.id} className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-all duration-300">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-xs break-all text-indigo-600 font-bold bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/30">{wh.url}</p>
                              {wh.description && (
                                <p className="text-xs text-slate-600 font-medium mt-2">{wh.description}</p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">
                                Secret Preview: <span className="font-mono text-slate-500">{wh.secretPreview}</span> · events: <span className="font-mono text-slate-500">{(wh.events ?? []).join(", ")}</span>
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 self-start ${
                                wh.enabled
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              {wh.enabled ? "Active" : "Paused"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => toggleWebhookEnabled(wh, !wh.enabled)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                            >
                              {wh.enabled ? "Pause" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => testWebhook(wh)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                            >
                              Send test
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteWebhook(wh)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors ml-auto cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          {wh.lastDeliveryAt && (
                            <p className="text-[10px] text-slate-400 font-semibold mt-1">
                              Last delivery: <span className="text-slate-600">{new Date(wh.lastDeliveryAt).toLocaleString()}</span> · status:{" "}
                              <span className={wh.lastDeliveryStatus === "success" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                {wh.lastDeliveryStatus === "success" ? "success" : "failed"}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {deliveries.length > 0 && (
                    <>
                      <h3 className="font-headline text-md font-bold text-slate-800 mb-3 mt-6">Recent webhook events</h3>
                      <ul className="space-y-2 text-sm mb-8">
                        {deliveries.map((d) => (
                          <li
                            key={d.id}
                            className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl px-4 py-3 flex flex-wrap gap-2 justify-between items-center shadow-sm"
                          >
                            <span className="font-mono text-xs font-bold text-slate-600">{d.event}</span>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${d.success ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-rose-50 text-rose-700 font-bold"}`}>
                                {d.success ? `OK ${d.httpStatus ?? ""}` : d.errorMessage || "Failed"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              {activeTab === "withdrawals" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[
                      { label: "Total earned", value: `${(withdrawalData?.totalEarned ?? 0).toFixed(4)} ALGO`, desc: "Accrued from paid API calls", accent: "text-indigo-600" },
                      { label: "Total withdrawn", value: `${(withdrawalData?.totalWithdrawn ?? 0).toFixed(4)} ALGO`, desc: "Completed payouts", accent: "text-slate-800" },
                      { label: "Withdrawable balance", value: `${(withdrawalData?.withdrawable ?? 0).toFixed(4)} ALGO`, desc: `Min ${(withdrawalData?.minWithdrawalAlgo ?? 0.1).toFixed(1)} ALGO payout`, accent: "text-emerald-600" },
                    ].map((c, i) => (
                      <div key={i} className="bg-white/70 backdrop-blur-md border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{c.label}</span>
                          <p className={`font-headline text-2xl font-extrabold mt-3 ${c.accent}`}>{c.value}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 font-semibold border-t border-slate-100 pt-2">{c.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 mb-8 shadow-sm">
                    <h2 className="font-headline text-lg font-bold text-slate-900 mb-1">Request withdrawal</h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Payouts are sent from the Sentinal TestNet treasury to:{" "}
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">{user?.walletAddress?.slice(0, 12)}…</span>
                    </p>
                    <form onSubmit={submitWithdrawal} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount (ALGO)</label>
                        <input
                          type="number"
                          step="0.000001"
                          min={withdrawalData?.minWithdrawalAlgo ?? 0.1}
                          max={withdrawalData?.withdrawable ?? undefined}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.100000"
                          disabled={withdrawing}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={withdrawing || (withdrawalData?.withdrawable ?? 0) < (withdrawalData?.minWithdrawalAlgo ?? 0.1)}
                        className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {withdrawing && (
                          <span className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {withdrawing ? "Submitting on-chain…" : "Withdraw"}
                      </button>
                    </form>
                  </div>

                  <h2 className="font-headline text-lg font-bold text-slate-900 mb-4">Withdrawal history</h2>
                  {(withdrawalData?.withdrawals ?? []).length === 0 ? (
                    <div className="bg-white/50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">
                      No withdrawals yet. platform payouts will appear here.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-sm">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead className="bg-slate-50/60 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          <tr>
                            <th className="px-5 py-3 font-bold">Date</th>
                            <th className="px-5 py-3 font-bold">Amount</th>
                            <th className="px-5 py-3 font-bold">Status</th>
                            <th className="px-5 py-3 font-bold">Transaction</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {(withdrawalData?.withdrawals ?? []).map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-5 py-3.5 text-slate-500 font-medium">
                                {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                              </td>
                              <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{Number(row.amountAlgo).toFixed(6)} ALGO</td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    row.status === "completed"
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      : row.status === "pending"
                                        ? "bg-amber-50 border-amber-200 text-amber-900"
                                        : "bg-red-50 border-red-200 text-red-850"
                                  }`}
                                >
                                  {row.status === "completed"
                                    ? "Completed"
                                    : row.status === "pending"
                                      ? "Pending"
                                      : "Failed"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {row.txId ? (
                                  <a
                                    href={testnetTxUrl(row.txId)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-xs text-indigo-600 hover:text-indigo-700 underline font-bold"
                                  >
                                    {row.txId.slice(0, 12)}…
                                  </a>
                                ) : row.errorDetail ? (
                                  <span className="text-xs text-rose-600 font-medium">{row.errorDetail}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
