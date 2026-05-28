import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
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
      to={`/dashboard/services/${s._id}`}
      className="block bg-white border border-surface-variant rounded-md p-6 hover:border-secondary transition-colors editorial-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-headline font-semibold text-primary text-lg">{s.title}</h2>
        {s.isSentinalOfficial && (
          <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Official API
          </span>
        )}
      </div>
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
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const categories = useMemo(() => {
    const map = new Map();
    services.forEach((s) => {
      const key = s.aiProvider || "Other";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries());
  }, [services]);
  const featured = useMemo(() => services.slice(0, 4), [services]);
  const trending = useMemo(
    () => [...services].sort((a, b) => (b.totalUses ?? 0) - (a.totalUses ?? 0)).slice(0, 4),
    [services]
  );

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
    <div className="max-w-5xl">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Marketplace</h1>
        <p className="text-on-surface-variant text-sm mb-8">
          Browse AI APIs. Pricing is per thousand tokens consumed (with a per-call minimum).
        </p>
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Categories</p>
            <p className="font-headline text-xl text-primary mt-1">{categories.length}</p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Featured APIs</p>
            <p className="font-headline text-xl text-primary mt-1">{featured.length}</p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Verified Creators</p>
            <p className="font-headline text-xl text-primary mt-1">{Math.max(1, Math.floor(services.length / 2))}</p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Trending APIs</p>
            <p className="font-headline text-xl text-primary mt-1">{trending.length}</p>
          </div>
        </section>

        <section className="mb-8 bg-white border border-surface-variant rounded-md p-4">
          <h2 className="font-semibold text-primary mb-3">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(([name, count]) => (
              <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {name} ({count})
              </span>
            ))}
          </div>
        </section>

        {loading ? (
          <p className="text-on-surface-variant">Loading services…</p>
        ) : services.length === 0 ? (
          <p className="text-on-surface-variant">No services yet. Ask a creator to publish one.</p>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="font-semibold text-primary mb-4">Featured APIs</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {featured.map((s) => (
                  <MarketplaceCard key={s._id} s={s} />
                ))}
              </div>
            </section>
            <section className="mb-8">
              <h2 className="font-semibold text-primary mb-4">Trending APIs</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {trending.map((s) => (
                  <MarketplaceCard key={s._id} s={s} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-semibold text-primary mb-4">Creator Previews</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {services.slice(0, 3).map((s) => (
                  <div key={`creator-${s._id}`} className="bg-white border border-surface-variant rounded-md p-4">
                    <p className="font-semibold text-sm text-primary">{s.title}</p>
                    <p className="text-xs text-on-surface-variant mt-1">Provider: {s.aiProvider || "Unknown"}</p>
                    <p className="text-xs text-on-surface-variant mt-1">Verified creator profile preview</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
    </div>
  );
}
