import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import { useTokenEstimate } from "../hooks/useTokenEstimate.js";

// ── Inline bar chart (no external dep) ───────────────────────────────────────
const CHART_H = 160; // px — must match the container height below
const LABEL_H = 20;  // px — reserved for the month label
const BAR_AREA = CHART_H - LABEL_H;

function BarChart({
  bars,
  color = "#031634",          // default: primary
  labelKey = "label",
  valueKey = "totalAlgo",
  secondaryKey = "totalINR",
  prefix = "ALGO",
  secondaryPrefix = "₹",
}) {
  const max = Math.max(...bars.map((b) => b[valueKey] ?? 0), 0.0001);

  return (
    <div className="w-full relative" style={{ height: CHART_H }}>
      {/* Y-axis grid lines */}
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <div
          key={frac}
          className="absolute left-0 right-0 border-t border-dashed border-surface-container-high pointer-events-none"
          style={{ bottom: LABEL_H + BAR_AREA * frac }}
        />
      ))}

      {/* Bars */}
      <div className="absolute inset-0 flex items-end gap-1 px-1">
        {bars.map((bar, i) => {
          const val = bar[valueKey] ?? 0;
          const barPx = Math.max((val / max) * BAR_AREA, 2);
          const alpha = 0.55 + (i / Math.max(bars.length - 1, 1)) * 0.45;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group"
              style={{ height: CHART_H }}
            >
              {/* Hover tooltip */}
              <div className="relative flex flex-col items-center w-full" style={{ height: BAR_AREA }}>
                <div
                  className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10 flex flex-col items-center"
                  style={{ bottom: barPx + 4 }}
                >
                  <div className="bg-primary text-white text-[10px] rounded px-2 py-1 whitespace-nowrap font-mono shadow-lg leading-tight">
                    <span className="font-semibold">{val.toFixed(4)} {prefix}</span><br />
                    <span className="text-blue-200">{secondaryPrefix}{(bar[secondaryKey] ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="w-2 h-2 bg-primary rotate-45 -mt-[5px]" />
                </div>

                {/* The actual bar */}
                <div
                  className="absolute bottom-0 left-[10%] right-[10%] rounded-t-sm transition-all duration-700"
                  style={{
                    height: barPx,
                    backgroundColor: color,
                    opacity: alpha,
                  }}
                />
              </div>

              {/* Label */}
              <span
                className="text-[8px] text-on-surface-variant text-center truncate w-full px-0.5"
                style={{ height: LABEL_H, lineHeight: `${LABEL_H}px` }}
              >
                {bar[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Confidence ring ───────────────────────────────────────────────────────────
function ConfidenceRing({ value }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 70 ? "#006b5b" : value >= 50 ? "#e1a800" : "#ba1a1a";
  return (
    <svg width="68" height="68" className="rotate-[-90deg]">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#e2e2e2" strokeWidth="7" />
      <circle
        cx="34" cy="34" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ direction, pct }) {
  const map = {
    increasing: { icon: "trending_up", cls: "text-error bg-error-container" },
    decreasing: { icon: "trending_down", cls: "text-secondary bg-secondary-container" },
    stable: { icon: "trending_flat", cls: "text-on-surface-variant bg-surface-container" },
  };
  const { icon, cls } = map[direction] ?? map.stable;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-surface-container-high rounded ${className}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PredictionDashboard() {
  const { user, logout } = useAuth();

  const [usage, setUsage] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Controls
  const [model, setModel] = useState("linear");
  const [forecastMonths, setForecastMonths] = useState(3);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [walletFilter, setWalletFilter] = useState("all"); // "all" | "mine"
  const [costPreviewText, setCostPreviewText] = useState("");
  const DEMO_PPT = 0.01;
  const DEMO_MIN = 0.001;
  const { estimatedAlgo, minApplies } = useTokenEstimate(costPreviewText, DEMO_PPT, DEMO_MIN);

  async function fetchData() {
    setLoading(true);
    try {
      const wallet = walletFilter === "mine" ? user?.walletAddress : undefined;
      const params = new URLSearchParams({ model, forecastMonths, historyMonths });
      if (wallet) params.set("wallet", wallet);

      const [usageRes, historyRes] = await Promise.all([
        api.get(`/api/prediction/usage?${params}`).catch((e) => ({ data: null, error: e })),
        api.get(`/api/prediction/history?historyMonths=12${wallet ? `&wallet=${wallet}` : ""}`).catch((e) => ({ data: null })),
      ]);

      setUsage(usageRes.data);
      setHistoryData(historyRes.data);
    } catch {
      toast.error("Failed to load prediction data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [model, forecastMonths, historyMonths, walletFilter]);

  const noHistory = usage?.error?.includes("Not enough");

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-surface-container-high px-6 py-3 flex justify-between items-center h-16">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-headline font-semibold text-xl tracking-tighter text-primary">
            Sentinal
          </Link>
          <span className="bg-secondary text-white text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider">
            Analytics
          </span>
        </div>
        <div className="flex items-center gap-6">
          <UserLiveWalletBar walletAddress={user?.walletAddress} />
          <button
            type="button"
            onClick={() => { logout(); window.location.href = "/"; }}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-surface-container-high flex-col py-8 font-body text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
        <div className="px-6 mb-8">
          <h3 className="text-primary font-semibold">User</h3>
          <p className="text-on-surface-variant text-xs">Verified Role</p>
        </div>
        <Link to="/user/marketplace" className="flex items-center space-x-3 px-6 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">storefront</span>
          <span>Marketplace</span>
        </Link>
        <Link to="/user/dashboard" className="flex items-center space-x-3 px-6 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">key</span>
          <span>Keys &amp; usage</span>
        </Link>
        <Link to="/user/analytics" className="flex items-center space-x-3 px-6 py-3 text-primary font-semibold border-r-2 border-primary bg-surface-container">
          <span className="material-symbols-outlined">insights</span>
          <span>Usage Analytics</span>
        </Link>
        <Link to="/user/transactions" className="flex items-center space-x-3 px-6 py-3 text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined">receipt_long</span>
          <span>Transaction history</span>
        </Link>
      </aside>

      {/* ── Main ── */}
      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-6xl">

        {/* Page title + cost preview + controls */}
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <h1 className="font-headline text-2xl font-semibold text-primary">Usage Analytics</h1>
            <p className="text-sm text-on-surface-variant mt-1">AI-powered spend forecasting & wallet recommendations</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
            <div className="w-full lg:max-w-md border border-outline-variant rounded-md p-4 bg-white">
              <p className="text-xs font-medium text-primary mb-2">Live cost preview (illustrative 0.01 ALGO / 1k tok)</p>
              <textarea
                className="w-full border border-outline-variant rounded px-2 py-1.5 text-sm min-h-[72px]"
                placeholder="Type sample prompt text…"
                value={costPreviewText}
                onChange={(e) => setCostPreviewText(e.target.value)}
              />
              <p className="text-xs text-on-surface-variant mt-2">
                Estimated cost{" "}
                <span className="font-mono font-semibold text-secondary">{estimatedAlgo.toFixed(6)} ALGO</span>
                {minApplies && (
                  <span className="block text-amber-800 mt-1">Minimum charge applies ({DEMO_MIN} ALGO).</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
            {/* Wallet scope */}
            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="text-xs border border-outline-variant/50 rounded px-2 py-1.5 bg-white text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="all">Platform-wide</option>
              <option value="mine">My wallet</option>
            </select>

            {/* Model */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs border border-outline-variant/50 rounded px-2 py-1.5 bg-white text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="linear">Linear Regression</option>
              <option value="weighted">Weighted Avg</option>
            </select>

            {/* History months */}
            <select
              value={historyMonths}
              onChange={(e) => setHistoryMonths(Number(e.target.value))}
              className="text-xs border border-outline-variant/50 rounded px-2 py-1.5 bg-white text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {[3, 6, 12].map((m) => <option key={m} value={m}>History: {m}mo</option>)}
            </select>

            {/* Forecast months */}
            <select
              value={forecastMonths}
              onChange={(e) => setForecastMonths(Number(e.target.value))}
              className="text-xs border border-outline-variant/50 rounded px-2 py-1.5 bg-white text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {[1, 2, 3, 6].map((m) => <option key={m} value={m}>Forecast: {m}mo</option>)}
            </select>

            <button
              onClick={fetchData}
              className="text-xs bg-primary text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Refresh
            </button>
            </div>
          </div>
        </div>

        {loading ? (
          /* ── Skeleton ── */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-56 w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          </div>

        ) : usage && !usage.error ? (
          <>
            {/* ── Top KPI strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-surface-variant rounded-md p-5">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Avg Historical</p>
                <p className="font-headline text-xl text-primary mt-1 font-semibold">{usage.summary.avgHistoricalAlgo.toFixed(4)}</p>
                <p className="text-xs text-on-surface-variant">ALGO / month</p>
              </div>
              <div className="bg-white border border-surface-variant rounded-md p-5">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Avg Forecast</p>
                <p className="font-headline text-xl text-primary mt-1 font-semibold">{usage.summary.avgForecastAlgo.toFixed(4)}</p>
                <p className="text-xs text-on-surface-variant">ALGO / month</p>
              </div>
              <div className="bg-white border border-surface-variant rounded-md p-5">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Trend</p>
                <div className="mt-2">
                  <TrendBadge direction={usage.summary.trendDirection} pct={usage.summary.trendPercent} />
                </div>
                <p className="text-xs text-on-surface-variant mt-1 capitalize">{usage.summary.trendDirection}</p>
              </div>
              <div className="bg-white border border-surface-variant rounded-md p-5 flex flex-col items-center justify-center gap-1">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Confidence</p>
                <div className="relative">
                  <ConfidenceRing value={usage.confidence} />
                  <span className="absolute inset-0 flex items-center justify-center font-headline font-bold text-sm text-primary">{usage.confidence}%</span>
                </div>
                <p className="text-xs text-on-surface-variant">{usage.model} model</p>
              </div>
            </div>

            {/* ── Historical chart ── */}
            <div className="bg-white border border-surface-variant rounded-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-headline font-semibold text-primary text-base">Historical Spend</h2>
                  <p className="text-xs text-on-surface-variant">Monthly ALGO transactions (hover for INR)</p>
                </div>
                {historyData && (
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant">Total ({historyData.total.txs} txns)</p>
                    <p className="font-mono text-sm font-semibold text-primary">{historyData.total.algo?.toFixed(4)} ALGO</p>
                    <p className="font-mono text-xs text-secondary">₹{historyData.total.inr?.toFixed(2)}</p>
                  </div>
                )}
              </div>
              {usage.history.length > 0
                ? <BarChart bars={usage.history} labelKey="label" valueKey="totalAlgo" secondaryKey="totalINR" color="#031634" />
                : <p className="text-sm text-on-surface-variant text-center py-8">No historical data for this period.</p>
              }
            </div>

            {/* ── Forecast section ── */}
            <div className="mb-6">
              <h2 className="font-headline font-semibold text-primary text-base mb-3">
                Forecast — Next {forecastMonths} month{forecastMonths > 1 ? "s" : ""}
              </h2>
              <div className="bg-white border border-surface-variant rounded-md p-6">
                {usage.forecast.length > 0 ? (
                  <>
                    <BarChart
                      bars={usage.forecast.map(f => ({ label: f.label, totalAlgo: f.predictedAlgo, totalINR: f.predictedINR }))}
                      color="#006b5b"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      {usage.forecast.map((f, i) => (
                        <div key={i} className="bg-surface-container-low border border-outline-variant/30 rounded p-4">
                          <p className="text-xs text-on-surface-variant font-semibold">{f.label}</p>
                          <p className="font-headline text-lg text-primary mt-1">{f.predictedAlgo} <span className="text-sm font-body font-normal text-on-surface-variant">ALGO</span></p>
                          <p className="text-xs font-mono text-secondary mt-0.5">${f.predictedUSD} · ₹{f.predictedINR}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant text-center py-8">No forecast available.</p>
                )}
              </div>
            </div>

            {/* ── Wallet recommendation ── */}
            <div className="bg-primary-container border border-primary/20 rounded-md p-6">
              <div className="flex items-start gap-4">
                <div className="bg-secondary w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white text-[20px]">wallet</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-semibold text-primary text-base">Wallet Top-Up Recommendation</h3>
                  <p className="text-sm text-on-surface-variant mt-1">{usage.recommendation.message}</p>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Next 30 days</p>
                      <p className="font-mono font-semibold text-primary">{usage.recommendation.next30dAlgo} ALGO</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Recommended top-up</p>
                      <p className="font-mono font-semibold text-secondary">{usage.recommendation.topupAlgo} ALGO</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">In INR</p>
                      <p className="font-mono font-semibold text-primary">₹{usage.recommendation.topupINR}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Safety buffer</p>
                      <p className="font-mono font-semibold text-on-surface-variant">{usage.recommendation.bufferPct}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>

        ) : (
          /* ── Not enough data state ── */
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl">bar_chart</span>
            </div>
            <h2 className="font-headline text-lg font-semibold text-primary">Not enough data yet</h2>
            <p className="text-sm text-on-surface-variant max-w-xs">
              {usage?.error ?? "At least 2 months of transaction history are needed to generate a prediction."}
            </p>

            {/* Still show the raw history if available */}
            {historyData?.periods?.length > 0 && (
              <div className="bg-white border border-surface-variant rounded-md p-6 mt-6 w-full max-w-lg text-left">
                <h3 className="font-headline text-base font-semibold text-primary mb-3">Raw History</h3>
                <BarChart
                  bars={historyData.periods.map(p => ({ label: p.label, totalAlgo: p.totalAlgo, totalINR: p.totalINR }))}
                  color="#031634"
                />
                <div className="mt-3 flex gap-6 font-mono text-sm">
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Total ALGO</p>
                    <p className="text-primary font-semibold">{historyData.total.algo?.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Total INR</p>
                    <p className="text-secondary font-semibold">₹{historyData.total.inr?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Transactions</p>
                    <p className="text-primary font-semibold">{historyData.total.txs}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
