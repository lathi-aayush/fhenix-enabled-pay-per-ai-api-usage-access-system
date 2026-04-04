import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import { chargeForTokens } from "../utils/tokenPricing.js";
import { useTokenEstimate } from "../hooks/useTokenEstimate.js";

function MarketplaceCard({ s }) {
  const [estWords, setEstWords] = useState("300");
  const ppt = Number(s.pricePerThousandTokens);
  const minC = Number(s.minimumChargeAlgo);

  const syntheticForHook = useMemo(() => {
    const w = Math.min(8000, Math.max(0, parseInt(estWords, 10) || 0));
    return "word ".repeat(w);
  }, [estWords]);

  const { estimatedAlgo: hookEst, minApplies: hookMin } = useTokenEstimate(syntheticForHook, ppt, minC);

  const tokensFromWords = useMemo(() => {
    const w = parseFloat(estWords);
    if (!Number.isFinite(w) || w <= 0) return 0;
    return Math.ceil(w * (4 / 3));
  }, [estWords]);

  const estAlgo = useMemo(() => {
    if (!Number.isFinite(ppt) || !Number.isFinite(minC) || tokensFromWords <= 0) return null;
    return chargeForTokens(tokensFromWords, ppt, minC);
  }, [ppt, minC, tokensFromWords]);

  const example400 = useMemo(() => {
    if (!Number.isFinite(ppt) || !Number.isFinite(minC)) return null;
    return chargeForTokens(400, ppt, minC);
  }, [ppt, minC]);

  return (
    <Link
      to={`/user/services/${s._id}`}
      className="block bg-white border border-surface-variant rounded-md p-6 hover:border-secondary transition-colors editorial-shadow"
    >
      <h2 className="font-headline font-semibold text-primary text-lg">{s.title}</h2>
      <p className="text-sm text-on-surface-variant mt-2 line-clamp-3">{s.description}</p>
      <p className="mt-2 text-xs text-on-surface-variant">
        {(s.aiProvider || "—") + " · " + (s.modelName || "—")}
      </p>
      <p className="mt-2 text-xs text-on-surface-variant">Calls: {s.totalUses ?? 0}</p>
      <p className="mt-3 text-secondary font-mono text-sm font-semibold">
        {Number.isFinite(ppt) ? ppt.toFixed(6) : "—"} ALGO / 1k tokens
      </p>
      <p className="mt-1 text-xs text-on-surface-variant font-mono">
        Min/call: {Number.isFinite(minC) ? `${minC.toFixed(6)} ALGO` : "—"}
      </p>
      {example400 != null && (
        <p className="mt-3 text-xs text-on-surface-variant border-t border-surface-variant pt-3">
          Example: ~100 word prompt + ~200 word reply ≈ 400 tokens → ~{" "}
          <span className="font-mono text-secondary font-semibold">{example400.toFixed(6)} ALGO</span>
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-surface-variant" onClick={(e) => e.stopPropagation()}>
        <label className="text-xs text-on-surface-variant">Estimate total words (prompt + expected reply)</label>
        <div className="flex gap-2 mt-1 items-center">
          <input
            type="number"
            min="1"
            className="w-28 border border-outline-variant rounded px-2 py-1 text-xs font-mono"
            value={estWords}
            onChange={(e) => setEstWords(e.target.value)}
          />
          {estAlgo != null && (
            <span className="text-xs font-mono text-secondary">
              ≈ {tokensFromWords} tok → ~{estAlgo.toFixed(6)} ALGO
            </span>
          )}
        </div>
        <p className="text-[11px] text-on-surface-variant mt-2">
          Estimated cost{" "}
          <span className="font-mono text-secondary font-semibold">{hookEst.toFixed(6)} ALGO</span>
          {hookMin && <span className="block text-amber-800">Minimum charge applies.</span>}
        </p>
      </div>
    </Link>
  );
}

export default function UserMarketplace() {
  const { user, logout } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/services");
        if (!cancelled) setServices(data);
      } catch {
        toast.error("Failed to load services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white dark:bg-slate-900 fixed top-0 z-50 w-full border-b border-slate-100 dark:border-slate-800 h-16 px-6 flex justify-between items-center font-body text-sm">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold tracking-tight font-headline text-slate-900 dark:text-white">
            Sentinal
          </Link>
          <nav className="hidden md:flex space-x-6">
            <span className="text-slate-900 dark:text-white font-semibold px-3 py-2 rounded-md">Marketplace</span>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <UserLiveWalletBar walletAddress={user?.walletAddress} />
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="text-slate-500 hover:text-slate-900 text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 flex-col py-8 font-body text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
        <div className="px-6 mb-8">
          <h3 className="text-slate-900 dark:text-white font-semibold">User</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs">Verified Role</p>
        </div>
        <Link
          to="/user/marketplace"
          className="flex items-center space-x-3 px-6 py-3 text-slate-900 dark:text-white font-semibold border-r-2 border-slate-900 dark:border-slate-50 bg-slate-100 dark:bg-slate-900"
        >
          <span className="material-symbols-outlined">storefront</span>
          <span>Marketplace</span>
        </Link>
        <Link
          to="/user/dashboard"
          className="flex items-center space-x-3 px-6 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined">key</span>
          <span>Keys &amp; usage</span>
        </Link>
        <Link
          to="/user/analytics"
          className="flex items-center space-x-3 px-6 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined">insights</span>
          <span>Usage Analytics</span>
        </Link>
        <Link
          to="/user/transactions"
          className="flex items-center space-x-3 px-6 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span>Transaction history</span>
        </Link>
      </aside>

      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-5xl">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Marketplace</h1>
        <p className="text-on-surface-variant text-sm mb-8">
          Browse AI APIs. Pricing is per thousand tokens consumed (with a per-call minimum).
        </p>

        {loading ? (
          <p className="text-on-surface-variant">Loading services…</p>
        ) : services.length === 0 ? (
          <p className="text-on-surface-variant">No services yet. Ask a creator to publish one.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s) => (
              <MarketplaceCard key={s._id} s={s} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
