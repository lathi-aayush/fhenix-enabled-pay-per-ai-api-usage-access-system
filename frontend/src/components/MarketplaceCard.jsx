import React from "react";
import { Link, useNavigate } from "react-router-dom";

export function StarRating({ rating = 0, reviewCount = 0, size = "sm", showCount = true }) {
  const value = Number(rating) || 0;
  const starClass = size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex ${starClass}`} aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= Math.round(value) ? "text-amber-500" : "text-slate-300"}
          >
            ★
          </span>
        ))}
      </div>
      {showCount &&
        (reviewCount > 0 ? (
          <span className="text-xs text-on-surface-variant">({reviewCount})</span>
        ) : (
          <span className="text-xs text-on-surface-variant">No reviews</span>
        ))}
    </div>
  );
}

export function shortenWallet(addr) {
  if (!addr || typeof addr !== "string") return "—";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function MarketplaceCard({ s, compact = false }) {
  const navigate = useNavigate();
  const ppt = Number(s.pricePerThousandTokens);
  const minC = Number(s.minimumChargeAlgo);
  const creatorLabel = s.creatorDisplayName || shortenWallet(s.creatorWallet);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/marketplace/services/${s._id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/marketplace/services/${s._id}`);
        }
      }}
      className="block bg-white border border-surface-variant rounded-md p-6 hover:border-secondary transition-colors editorial-shadow h-full cursor-pointer text-left"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="font-headline font-semibold text-primary text-lg leading-snug">{s.title}</h2>
        {s.isSentinalOfficial && (
          <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
            Official
          </span>
        )}
      </div>

      <StarRating rating={s.averageRating} reviewCount={s.reviewCount} />

      <p className="text-sm text-on-surface-variant mt-2 line-clamp-3">{s.description}</p>
      <p className="mt-2 text-xs text-on-surface-variant">
        {(s.aiProvider || "—") + " · " + (s.modelName || "—")}
      </p>

      {s.creatorWallet && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Creator:{" "}
          <Link
            to={`/marketplace/creators/${encodeURIComponent(s.creatorWallet)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-secondary hover:underline font-medium"
          >
            {creatorLabel}
          </Link>
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {s.x402Enabled && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            x402
          </span>
        )}
        <span className="text-xs text-on-surface-variant">Calls: {s.totalUses ?? 0}</span>
      </div>

      {!compact && (
        <>
          <p className="mt-3 text-secondary font-mono text-sm font-semibold">
            {Number.isFinite(ppt) ? ppt.toFixed(6) : "—"} ALGO / 1k tokens
          </p>
          <p className="mt-1 text-xs text-on-surface-variant font-mono">
            Min/call: {Number.isFinite(minC) ? `${minC.toFixed(6)} ALGO` : "—"}
          </p>
        </>
      )}
    </div>
  );
}
