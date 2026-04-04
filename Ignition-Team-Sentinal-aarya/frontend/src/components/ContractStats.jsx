import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ContractStats() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    try {
      const { data: d } = await api.get("/api/contract/stats");
      setData(d);
      setErr(null);
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not load contract stats");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  async function copyAddr() {
    if (!data?.contractAddress) return;
    try {
      await navigator.clipboard.writeText(data.contractAddress);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="mt-12 max-w-3xl mx-auto px-4">
      <h2 className="font-headline text-lg font-semibold text-primary mb-4 text-center">
        On-chain Sentinel vault
      </h2>
      {err && <p className="text-sm text-amber-800 text-center mb-4">{err}</p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Total deposits (count)</p>
          <p className="font-headline text-2xl text-primary mt-2">
            {(data?.totalPurchases ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-2">Sourced directly from Algorand blockchain</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Total ALGO processed</p>
          <p className="font-headline text-2xl text-secondary mt-2 font-mono">
            {(data?.totalAlgoProcessed ?? 0).toFixed(4)} ALGO
          </p>
          <p className="text-[10px] text-on-surface-variant mt-2">Sourced directly from Algorand blockchain</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Contract</p>
          <p className="font-mono text-sm text-primary mt-2 break-all">{shortAddr(data?.contractAddress)}</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={copyAddr}
              disabled={!data?.contractAddress}
              className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low disabled:opacity-50"
            >
              Copy address
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">Sourced directly from Algorand blockchain</p>
        </div>
      </div>
    </div>
  );
}
