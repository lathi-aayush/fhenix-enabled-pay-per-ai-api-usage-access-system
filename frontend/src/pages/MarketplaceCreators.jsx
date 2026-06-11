import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { shortenWallet } from "../components/MarketplaceCard.jsx";

export default function MarketplaceCreators() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/creator/directory");
        if (!cancelled) setCreators(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load creators");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-4 pb-8 w-full">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Creator Profiles</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Discover API creators and browse their published endpoints.
      </p>

      {loading ? (
        <p className="text-on-surface-variant text-sm">Loading creators…</p>
      ) : creators.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No creators have published services yet.</p>
      ) : (
        <div className="space-y-3">
          {creators.map((creator) => {
            const label = creator.displayName?.trim() || shortenWallet(creator.walletAddress);
            return (
              <Link
                key={creator.walletAddress}
                to={`/marketplace/creators/${encodeURIComponent(creator.walletAddress)}`}
                className="bg-white border border-surface-variant rounded-md p-4 flex justify-between items-center hover:border-secondary transition-colors"
              >
                <div>
                  <p
                    className={`font-semibold text-primary text-sm ${
                      creator.displayName?.trim() ? "" : "font-mono"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {creator.apis} listed API{creator.apis === 1 ? "" : "s"} · {creator.totalUses} total calls
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    creator.hasOfficial
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {creator.hasOfficial ? "Official listing" : "Community"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
