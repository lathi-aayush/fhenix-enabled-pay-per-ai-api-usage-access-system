import React, { useEffect, useState } from "react";

export default function PricingDocs() {
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
          <span className="text-slate-600 font-semibold">Pricing & Micro-payments</span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight">Pricing & Micro-payments</h1>
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          Sentinal bypasses traditional SaaS monthly subscriptions, billing minimums, and credit card setups by replacing them with decentralized Web3 cryptographic micro-payments.
        </p>

        <div className="space-y-12 text-slate-800">
          
          {/* Section: Micro-payments */}
          <section>
            <h2 id="how-it-works" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">How Micro-payments Work</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Instead of paying flat monthly fees, users and autonomous agents pay creators a tiny fraction of a token (e.g. 0.01 ALGO) per individual API call. 
            </p>
            <ol className="space-y-4 text-[14px] text-slate-700 leading-relaxed list-decimal pl-5">
              <li>
                <strong>Pay-As-You-Go:</strong> You are charged only when your request returns a successful code from the model provider.
              </li>
              <li>
                <strong>Direct Settlement:</strong> The transaction is processed and settled peer-to-peer directly on-chain within 3.3 seconds.
              </li>
              <li>
                <strong>No Deposit Required:</strong> You don't need to fund a central portal; your agent transfers funds directly from its own wallet to the creator.
              </li>
            </ol>
          </section>

          {/* Section: Web3 & Crypto */}
          <section>
            <h2 id="web3-crypto" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Web3 & Cryptographic Infrastructure</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Microtransactions are powered by the Algorand blockchain and cryptographic keys:
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2">
                <span className="material-symbols-outlined text-indigo-500 text-2xl">vpn_key</span>
                <h4 className="font-semibold text-slate-900 text-[15px]">Ed25519 Keypairs</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Every user account and burner wallet owns a private key. Transactions are signed locally using digital signatures, ensuring only you can authorize spending.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-2">
                <span className="material-symbols-outlined text-emerald-500 text-2xl">account_balance_wallet</span>
                <h4 className="font-semibold text-slate-900 text-[15px]">Self-Custody & Safety</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Sentinal does not custody user keys. Burner wallets live inside local browser memory, allowing seamless machine-to-machine payments while keeping main funds safe.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Costs */}
          <section>
            <h2 id="cost-models" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Cost Models & Network Fees</h2>
            <div className="space-y-4 text-[14px] text-slate-700 leading-relaxed">
              <p>
                There are two types of fees involved in executing pay-per-usage API queries:
              </p>
              <ul className="space-y-3 list-disc pl-5 text-slate-600">
                <li>
                  <strong>API Usage Fee:</strong> Set dynamically by the creator who listed the model. Paid in ALGO or custom ASAs directly to the creator's wallet.
                </li>
                <li>
                  <strong>Algorand Network Gas:</strong> A standard fee of 0.001 ALGO required by the blockchain ledger to process and record the transaction.
                </li>
              </ul>
            </div>
          </section>

        </div>
      </div>

      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">On this Page</h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a href="#how-it-works" onClick={(e) => handleClick(e, 'how-it-works')} className={navLinkClass("how-it-works")}>
                How Micro-payments Work
              </a>
            </li>
            <li>
              <a href="#web3-crypto" onClick={(e) => handleClick(e, 'web3-crypto')} className={navLinkClass("web3-crypto")}>
                Web3 & Cryptography
              </a>
            </li>
            <li>
              <a href="#cost-models" onClick={(e) => handleClick(e, 'cost-models')} className={navLinkClass("cost-models")}>
                Cost Models & Fees
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
