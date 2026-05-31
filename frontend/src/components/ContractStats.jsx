import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function AnimatedCounter({ to, duration = 1800, decimals = 0, suffix = "" }) {
  const [val, setVal] = useState(0);
  const [ref, visible] = useInView();
  
  useEffect(() => {
    if (!visible || to <= 0) {
      if (!visible) setVal(0);
      return;
    }
    let start = null;
    let raf = 0;
    const from = val;
    const delta = to - from;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3; // Cubic easeOut
      setVal(from + delta * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else setVal(to);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, to, duration]);
  
  const formatted = decimals > 0 
    ? val.toFixed(decimals) 
    : Math.floor(val).toLocaleString();

  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}

function StatCard({ label, numericValue, decimals = 0, suffix = "", hint, accent = "primary" }) {
  const valueClass =
    accent === "secondary"
      ? "text-emerald-600 font-mono font-bold"
      : accent === "indigo"
        ? "text-indigo-600 font-bold"
        : "text-slate-900 font-bold";
        
  const glowClass = 
    accent === "secondary"
      ? "group-hover:shadow-emerald-500/10 group-hover:border-emerald-300"
      : accent === "indigo"
        ? "group-hover:shadow-indigo-500/10 group-hover:border-indigo-300"
        : "group-hover:shadow-indigo-500/5 group-hover:border-indigo-200";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`group bg-gradient-to-br from-white/95 to-slate-50/50 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-xl ${glowClass} hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between`}
    >
      <div>
        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
        <p className={`font-headline text-2xl mt-2 tracking-tight ${valueClass}`}>
          <AnimatedCounter to={numericValue} decimals={decimals} suffix={suffix} />
        </p>
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-3 leading-relaxed border-t border-slate-100/50 pt-2">{hint}</p>}
    </motion.div>
  );
}

export default function ContractStats() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    try {
      const { data: resData } = await api.get("/api/contract/stats");
      setData(resData);
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
    <section className="mt-20 max-w-5xl mx-auto px-6">
      <div className="text-center mb-8 flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100/50">
          On-Chain Validation
        </span>
        <h2 className="font-headline text-3xl font-bold text-slate-900 leading-tight">
          Live Platform Metrics
        </h2>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Real usage from Sentinel and balances read directly from the Algorand blockchain.
        </p>
        {data?.network && (
          <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {networkLabel}
          </span>
        )}
      </div>

      {err && <p className="text-sm text-amber-800 text-center mb-4">{err}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Paid API calls"
          numericValue={p?.totalApiCalls ?? 0}
          hint={`${(p?.verifiedPayments ?? 0).toLocaleString()} with on-chain payment tx`}
        />
        <StatCard
          label="ALGO paid to creators"
          numericValue={p?.totalAlgoPaid ?? 0}
          suffix=" ALGO"
          decimals={4}
          accent="secondary"
          hint="Sum of successful marketplace charges"
        />
        <StatCard
          label="Active APIs"
          numericValue={p?.activeServices ?? 0}
          accent="indigo"
          hint={`${(p?.creators ?? 0).toLocaleString()} creators · ${(p?.connectedWallets ?? 0).toLocaleString()} wallets`}
        />
        <StatCard
          label="Tokens served"
          numericValue={p?.totalTokensServed ?? 0}
          hint="Input + output tokens across all calls"
        />
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-6">
        {/* Platform Treasury Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="group bg-gradient-to-br from-white/95 to-slate-50/50 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-500 flex flex-col justify-between"
        >
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Platform treasury</p>
            <p className="font-headline text-2xl text-emerald-600 font-mono font-bold mt-2">
              {treasury?.balanceAlgo != null ? (
                <AnimatedCounter to={treasury.balanceAlgo} decimals={4} suffix=" ALGO" />
              ) : (
                "—"
              )}
            </p>
            <p className="font-mono text-xs text-slate-400 mt-2 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
              {treasury?.address || "Not configured"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {treasury?.address && (
              <button
                type="button"
                onClick={() => copyText(treasury.address, "Treasury address")}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Copy address
              </button>
            )}
            {treasury?.explorerUrl && (
              <a
                href={treasury.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700 font-semibold"
              >
                View on explorer
              </a>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-100/50 pt-2 leading-relaxed">
            Live balance from Algorand · receives Studio upgrades and platform flows
          </p>
        </motion.div>

        {/* On-Chain Vault Contract Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="group bg-gradient-to-br from-white/95 to-slate-50/50 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-500 flex flex-col justify-between"
        >
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">On-chain vault contract</p>
            {contract?.configured ? (
              <>
                <p className="font-headline text-2xl text-slate-900 font-bold mt-2">
                  <AnimatedCounter to={contract.totalPurchases ?? 0} /> purchases
                </p>
                <p className="font-headline text-lg text-emerald-600 font-mono font-bold mt-1">
                  <AnimatedCounter to={contract.totalAlgoProcessed ?? 0} decimals={4} suffix=" ALGO" />
                </p>
                <div className="font-mono text-xs text-slate-400 mt-2 break-all bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col gap-0.5">
                  <div>App ID: {contract.appId}</div>
                  <div className="truncate">Address: {contract.address}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {contract.address && (
                    <button
                      type="button"
                      onClick={() => copyText(contract.address, "Contract address")}
                      className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      Copy address
                    </button>
                  )}
                  {contract.explorerUrl && (
                    <a
                      href={contract.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700 font-semibold"
                    >
                      View app
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-100/50 pt-2 leading-relaxed">
                  Global counters from deployed Sentinel smart contract
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  No vault app deployed yet. Marketplace payments still go directly to creator wallets and
                  are tracked above.
                </p>
                <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-100/50 pt-2 font-mono">
                  Deploy the contract and set contract/contract_info.json or ALGO_APP_ID in the backend to enable counters.
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>


    </section>
  );
}
