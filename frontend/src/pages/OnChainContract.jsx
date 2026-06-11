import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ContractStats from "../components/ContractStats.jsx";
import { api } from "../api/client.js";
import toast from "react-hot-toast";

export default function OnChainContract() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [network, setNetwork] = useState("testnet");

  async function loadActivity() {
    try {
      const { data } = await api.get("/api/contract/activity");
      setActivities(data.activities || []);
      setNetwork(data.network || "testnet");
      setErr(null);
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not load contract activity log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 15000);
    return () => clearInterval(interval);
  }, []);

  async function copyText(text, label) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 mb-8 gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary mb-2 flex items-center gap-2.5">
            <span className="material-symbols-outlined text-indigo-600">gavel</span>
            Smart Contract & On-Chain Registry
          </h1>
          <p className="text-sm text-on-surface-variant">
            Decentralized transaction telemetry and global ledger validation.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {network === "mainnet" ? "Algorand MainNet" : "Algorand TestNet"}
          </span>
          <button
            onClick={loadActivity}
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
            title="Refresh Feed"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Main contract statistics component */}
      <div className="-mt-16 mb-12 max-w-5xl mx-auto">
        <ContractStats />
      </div>

      {/* Verified On-Chain Transactions */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Verified Blockchain Activity Feed
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              The latest pay-per-use API payments verified directly on the Algorand blockchain.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-slate-100 text-slate-500 font-mono">
            {activities.length} Recent Logs
          </span>
        </div>

        {err && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm mb-4">
            {err}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Querying indexer activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <span className="material-symbols-outlined text-slate-300 text-5xl mb-3">
              receipt_long
            </span>
            <p className="text-slate-800 font-semibold text-sm">No transaction history found</p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Once users trigger AI agent pipelines and authorize Pera micro-payments, confirmed transactions will populate here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">User Wallet</th>
                  <th className="px-4 py-3.5">Service Requested</th>
                  <th className="px-4 py-3.5">On-Chain Charge</th>
                  <th className="px-4 py-3.5">Transaction ID</th>
                  <th className="px-4 py-3.5">Protocol</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence initial={false}>
                  {activities.map((act) => (
                    <motion.tr
                      key={act.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* User Wallet */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {act.maskedWallet ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100/70 border border-slate-200/50 px-2 py-1 rounded">
                              {act.maskedWallet}
                            </span>
                            <button
                              onClick={() => copyText(act.userWallet || act.maskedWallet, "Wallet")}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copy Full Address"
                            >
                              <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No wallet</span>
                        )}
                      </td>

                      {/* Service Title */}
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {act.serviceTitle}
                      </td>

                      {/* On-Chain Charge */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-emerald-600 font-bold">
                            {act.chargeAlgo.toFixed(6)} ALGO
                          </span>
                        </div>
                      </td>

                      {/* Transaction ID */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {act.paymentTxId ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={act.paymentExplorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {act.paymentTxId.slice(0, 8)}…{act.paymentTxId.slice(-4)}
                            </a>
                            <button
                              onClick={() => copyText(act.paymentTxId, "Transaction ID")}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copy Transaction ID"
                            >
                              <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">—</span>
                        )}
                      </td>

                      {/* Protocol */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {act.x402Payment ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                            x402
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            api/use
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400">
                        {act.createdAt ? new Date(act.createdAt).toLocaleString() : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ledger transparency message */}
      <div className="bg-gradient-to-r from-indigo-50/50 to-violet-50/50 border border-indigo-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[20px]">verified_user</span>
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">Decentralized Transparency Guarantee</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            All pay-per-use logs shown above are validated directly from the Algorand blockchain. Sentinal does not hold your funds. Marketplace micro-payments flow instantly from user wallets into verified on-chain vaults or creator balances in a completely trustless model.
          </p>
        </div>
      </div>
    </div>
  );
}
