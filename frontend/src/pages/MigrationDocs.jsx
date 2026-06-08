import React, { useEffect, useState } from "react";

export default function MigrationDocs() {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -80% 0px" }
    );
    const headings = document.querySelectorAll("h2[id], h3[id]");
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  const handleClick = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const navLinkClass = (id) =>
    `block py-1 text-[13px] transition-colors border-l-2 pl-3 -ml-[2px] ${
      activeId === id
        ? "border-indigo-600 text-indigo-700 font-medium"
        : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
    }`;

  return (
    <div className="flex h-full">
      <div className="flex-1 max-w-4xl px-8 py-10 lg:px-12 mx-auto min-h-screen pb-32">
        <div className="text-[12px] text-slate-400 font-medium mb-3 flex items-center gap-1.5">
          <span>Sentinal Protocol</span>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-slate-600 font-semibold">Migration</span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight">Migration Guide</h1>
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          Follow this guide to migrate your existing agents and creator services from Sentinal v1.0 to the optimized v2.0 protocol on the Algorand blockchain.
        </p>

        <div className="space-y-12 text-slate-800">
          <section>
            <h2 id="overview" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Overview of v2.0 Changes</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Sentinal v2.0 introduces deep performance gains and security upgrades:
            </p>
            <ul className="space-y-3 text-[14px] text-slate-600 leading-relaxed list-disc pl-5">
              <li><strong>Gas Optimizations:</strong> Smart contract call fees have been reduced by over 30% via state grouping.</li>
              <li><strong>Dynamic Fee Headers:</strong> The x402 header has changed to support custom ASAs (Algorand Standard Assets) in addition to ALGO.</li>
              <li><strong>Persistent Webhooks:</strong> Creators now receive real-time webhook updates on every successful microtransaction payout.</li>
            </ul>
          </section>

          <section>
            <h2 id="agent-migration" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Migrating Agents</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              To migrate your autonomous client scripts, upgrade the SDK client library and initialize with the new network configuration:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 overflow-x-auto">
              <pre className="text-[13px] text-slate-800 font-mono leading-relaxed">
{`// Old configuration (v1.0)
// const client = new SentinalClient({ key: 'old-key' });

// New configuration (v2.0)
import { SentinalClient } from "@sentinalapi/sdk";

const client = new SentinalClient({
  network: "testnet",
  autoRenewBurner: true // Automatically regenerates burner wallets
});`}
              </pre>
            </div>
          </section>

          <section>
            <h2 id="creator-migration" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Creator Upgrades</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Creators must re-register endpoints to activate the optimized smart contract indexing:
            </p>
            <ol className="space-y-4 text-[14px] text-slate-700 leading-relaxed list-decimal pl-5">
              <li>Go to the **Creator Dashboard** &gt; **My Endpoints**.</li>
              <li>Select your listed API service.</li>
              <li>Click **Update Contract** to sync with the new Algorand Application ID.</li>
            </ol>
          </section>
        </div>
      </div>

      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">On this Page</h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a href="#overview" onClick={(e) => handleClick(e, 'overview')} className={navLinkClass("overview")}>
                v2.0 Overview
              </a>
            </li>
            <li>
              <a href="#agent-migration" onClick={(e) => handleClick(e, 'agent-migration')} className={navLinkClass("agent-migration")}>
                Migrating Agents
              </a>
            </li>
            <li>
              <a href="#creator-migration" onClick={(e) => handleClick(e, 'creator-migration')} className={navLinkClass("creator-migration")}>
                Creator Upgrades
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
