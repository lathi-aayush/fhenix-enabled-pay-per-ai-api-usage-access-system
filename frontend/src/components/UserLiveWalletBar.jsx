import React from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getBurnerAddress,
  getBurnerBalance,
  fundBurnerWallet,
  refundBurnerWallet,
  getDefaultAlgodServer,
} from "../wallet/burner.js";

/** Shorten Algorand address for display (e.g. ABC123…XYZ9). */
export function shortenWallet(a) {
  if (!a || typeof a !== "string") return "—";
  const t = a.trim();
  if (t.length < 14) return t;
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export default function UserLiveWalletBar({ walletAddress }) {
  const { burnerReady } = useAuth();
  const [algo, setAlgo] = useState(null);
  const [burnerAlgo, setBurnerAlgo] = useState(null);
  const [burnerAddr, setBurnerAddr] = useState(null);
  const [fundAmount, setFundAmount] = useState("0."); // User input 
  const [isFunding, setIsFunding] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [showManage, setShowManage] = useState(false);
  
  const algodServer = getDefaultAlgodServer();

  useEffect(() => {
    if (!walletAddress) {
      setAlgo(null);
      setBurnerAlgo(null);
      setBurnerAddr(null);
      return;
    }
    if (!burnerReady) {
      setBurnerAlgo(null);
      setBurnerAddr(null);
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

      try {
        setBurnerAddr(getBurnerAddress());
        const bBal = await getBurnerBalance(algodServer);
        if (!cancelled) setBurnerAlgo(bBal);
      } catch {
        if (!cancelled) {
          setBurnerAlgo(null);
          setBurnerAddr(null);
        }
      }
    }
    load();
    const id = setInterval(load, 15000);
    const onWalletUpdate = () => load();
    window.addEventListener("walletBalanceUpdate", onWalletUpdate);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("walletBalanceUpdate", onWalletUpdate);
    };
  }, [walletAddress, burnerReady, algodServer]);

  const handleFund = async () => {
    if (!walletAddress) return toast.error("Connect main wallet first");
    const amountFloat = parseFloat(fundAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) return toast.error("Invalid amount");
    
    setIsFunding(true);
    try {
      const micro = Math.round(amountFloat * 1_000_000);
      await fundBurnerWallet(walletAddress, micro, algodServer);
      toast.success("Burner wallet funded");
      
      // Refresh balances
      const bBal = await getBurnerBalance(algodServer);
      setBurnerAlgo(bBal);
      setShowManage(false);
    } catch (e) {
      toast.error(e?.message || "Failed to fund burner");
    } finally {
      setIsFunding(false);
    }
  };

  const handleRefund = async () => {
    if (!walletAddress) return toast.error("Connect main wallet first");
    setIsRefunding(true);
    try {
      await refundBurnerWallet(walletAddress, algodServer);
      toast.success("Burner wallet refunded to Pera");
      
      const bBal = await getBurnerBalance(algodServer);
      setBurnerAlgo(bBal);
      setShowManage(false);
    } catch (e) {
      toast.error(e?.message || "Failed to refund burner");
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs sm:text-sm">
        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[18px] shrink-0">
          account_balance_wallet
        </span>
        <span className="font-mono text-slate-900 dark:text-slate-100 truncate max-w-[100px] sm:max-w-[160px]" title="Main Wallet">
          {shortenWallet(walletAddress)}
        </span>
        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
        <span className="font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
          {algo == null ? "…" : `${Number(algo).toFixed(4)}`}
        </span>
        
        {/* Burner Section */}
        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0" title="Burner Wallet">
          local_fire_department
        </span>
        <span className="font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
          {burnerAlgo == null ? "…" : `${(Number(burnerAlgo) / 1_000_000).toFixed(4)}`}
        </span>
        <button 
          onClick={() => setShowManage(!showManage)}
          className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-[10px] font-medium transition-colors"
        >
          Manage
        </button>
      </div>

      {showManage && (
        <div className="absolute top-[120%] right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-4 rounded-md w-[260px] z-50 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">local_fire_department</span>
              Burner Settings
            </span>
            <button onClick={() => setShowManage(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
          </div>
          
          <div className="text-xs text-slate-500 max-w-[220px]">
            The Burner wallet handles microtransactions automatically without Pera popups. Your funded balance
            is tied to this address and syncs to your account.
          </div>
          {burnerAddr && (
            <p className="text-[10px] font-mono text-slate-400 break-all" title={burnerAddr}>
              {shortenWallet(burnerAddr)}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <input 
              type="number" 
              step="0.1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="flex-1 w-full border border-slate-300 rounded px-2 py-1 text-sm bg-transparent dark:text-white"
              placeholder="0.5"
            />
            <span className="text-sm text-slate-600 font-mono font-medium">ALGO</span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleFund}
              disabled={isFunding}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-1.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {isFunding ? "..." : "Fund"}
            </button>
            <button 
              onClick={handleRefund}
              disabled={isRefunding}
              className="flex-1 border border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-1.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {isRefunding ? "..." : "Refund"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
