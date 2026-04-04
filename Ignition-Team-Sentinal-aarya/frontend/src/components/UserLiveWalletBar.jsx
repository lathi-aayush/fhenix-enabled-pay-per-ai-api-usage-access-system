import { useEffect, useState } from "react";
import { api } from "../api/client.js";

/** Shorten Algorand address for display (e.g. ABC123…XYZ9). */
export function shortenWallet(a) {
  if (!a || typeof a !== "string") return "—";
  const t = a.trim();
  if (t.length < 14) return t;
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export default function UserLiveWalletBar({ walletAddress }) {
  const [algo, setAlgo] = useState(null);

  useEffect(() => {
    if (!walletAddress) {
      setAlgo(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get("/api/user/algo-balance");
        if (!cancelled) setAlgo(data?.balanceAlgo ?? 0);
      } catch {
        if (!cancelled) setAlgo(null);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress]);

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs sm:text-sm">
      <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[18px] shrink-0">
        account_balance_wallet
      </span>
      <span className="font-mono text-slate-900 dark:text-slate-100 truncate max-w-[100px] sm:max-w-[160px]">
        {shortenWallet(walletAddress)}
      </span>
      <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
      <span className="font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
        {algo == null ? "…" : `${Number(algo).toFixed(4)} ALGO`}
      </span>
      <span className="text-[10px] text-slate-500 dark:text-slate-500 hidden md:inline shrink-0">
        on-chain
      </span>
    </div>
  );
}
