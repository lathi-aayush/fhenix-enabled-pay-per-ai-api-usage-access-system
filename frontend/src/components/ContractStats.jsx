import React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

function shortAddr(addr) {
  if (!addr || addr.length < 12) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function StatCard({ label, value, hint, accent = "primary" }) {
  const valueClass =
    accent === "secondary"
      ? "text-secondary font-mono"
      : accent === "indigo"
        ? "text-indigo-600"
        : "text-primary";
  return (
    <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm flex flex-col">
      <p className="text-xs text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className={`font-headline text-2xl mt-2 ${valueClass}`}>{value}</p>
      {hint && <p className="text-[10px] text-on-surface-variant mt-2 leading-relaxed">{hint}</p>}
    </div>
  );
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
      setErr(e?.response?.data?.error || "Could not load platform stats");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  async function copyText(text, label) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  const p = data?.platform;
  const treasury = data?.treasury;
  const contract = data?.contract;
  const networkLabel = data?.network === "mainnet" ? "MainNet" : "TestNet";

  return (
    <section className="mt-12 max-w-5xl mx-auto px-4">
      <div className="text-center mb-6">
        <h2 className="font-headline text-lg font-semibold text-primary">Live platform metrics</h2>
        <p className="text-sm text-on-surface-variant mt-1 max-w-xl mx-auto">
          Real usage from Sentinal and balances read from the Algorand {networkLabel} network.
        </p>
        {data?.network && (
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {networkLabel}
          </span>
        )}
      </div>

      {err && <p className="text-sm text-amber-800 text-center mb-4">{err}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Paid API calls"
          value={(p?.totalApiCalls ?? 0).toLocaleString()}
          hint={`${(p?.verifiedPayments ?? 0).toLocaleString()} with on-chain payment tx`}
        />
        <StatCard
          label="ALGO paid to creators"
          value={`${(p?.totalAlgoPaid ?? 0).toFixed(4)} ALGO`}
          accent="secondary"
          hint="Sum of successful marketplace charges"
        />
        <StatCard
          label="Active APIs"
          value={(p?.activeServices ?? 0).toLocaleString()}
          accent="indigo"
          hint={`${(p?.creators ?? 0).toLocaleString()} creators · ${(p?.connectedWallets ?? 0).toLocaleString()} wallets`}
        />
        <StatCard
          label="Tokens served"
          value={(p?.totalTokensServed ?? 0).toLocaleString()}
          hint="Input + output tokens across all calls"
        />
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Platform treasury</p>
          <p className="font-headline text-2xl text-emerald-600 font-mono mt-2">
            {treasury?.balanceAlgo != null
              ? `${treasury.balanceAlgo.toFixed(4)} ALGO`
              : "—"}
          </p>
          <p className="font-mono text-xs text-primary mt-2 break-all">
            {shortAddr(treasury?.address) || "Not configured"}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {treasury?.address && (
              <button
                type="button"
                onClick={() => copyText(treasury.address, "Treasury address")}
                className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low"
              >
                Copy address
              </button>
            )}
            {treasury?.explorerUrl && (
              <a
                href={treasury.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low text-primary font-semibold"
              >
                View on explorer
              </a>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">
            Live balance from Algorand · receives Studio upgrades and platform flows
          </p>
        </div>

        <div className="bg-white border border-surface-variant rounded-lg p-5 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">On-chain vault contract</p>
          {contract?.configured ? (
            <>
              <p className="font-headline text-2xl text-primary mt-2">
                {(contract.totalPurchases ?? 0).toLocaleString()} purchases
              </p>
              <p className="font-headline text-lg text-secondary font-mono mt-1">
                {(contract.totalAlgoProcessed ?? 0).toFixed(4)} ALGO
              </p>
              <p className="font-mono text-xs text-primary mt-2">
                App {contract.appId} · {shortAddr(contract.address)}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {contract.address && (
                  <button
                    type="button"
                    onClick={() => copyText(contract.address, "Contract address")}
                    className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low"
                  >
                    Copy address
                  </button>
                )}
                {contract.explorerUrl && (
                  <a
                    href={contract.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md border border-outline-variant hover:bg-surface-container-low text-primary font-semibold"
                  >
                    View app
                  </a>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2">
                Global counters from deployed Sentinel smart contract
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
                No vault app deployed yet. Marketplace payments still go directly to creator wallets and
                are tracked above.
              </p>
              <p className="text-[10px] text-on-surface-variant mt-3">
                Deploy the contract and set <span className="font-mono">contract/contract_info.json</span>{" "}
                or <span className="font-mono">ALGO_APP_ID</span> in the backend to enable on-chain counters.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
