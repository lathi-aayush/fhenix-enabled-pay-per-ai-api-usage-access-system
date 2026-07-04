import React from "react";

function shortAddress(address) {
  if (!address || typeof address !== "string") return "Wallet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function UserLiveWalletBar({ walletAddress }) {
  return (
    <div className="hidden lg:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <span className="material-symbols-outlined text-[15px] text-emerald-600">account_balance_wallet</span>
      <span className="font-mono">{shortAddress(walletAddress)}</span>
    </div>
  );
}
