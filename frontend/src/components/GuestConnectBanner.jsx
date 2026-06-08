import React from "react";
import { usePeraLogin } from "../context/PeraLoginContext.jsx";

export default function GuestConnectBanner({ message, className = "" }) {
  const { connectWithPera, busy } = usePeraLogin();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-sm text-emerald-900">
        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
        <span>{message || "Connect Pera Wallet to use this feature."}</span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => connectWithPera({ navigate: false })}
        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
      >
        {busy ? "Connecting…" : "Connect Pera Wallet"}
      </button>
    </div>
  );
}
