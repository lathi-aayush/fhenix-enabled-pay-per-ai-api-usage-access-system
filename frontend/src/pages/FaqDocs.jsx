import React, { useEffect, useState } from "react";

export default function FaqDocs() {
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
          <span className="text-slate-600 font-semibold">FAQ</span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight">Frequently Asked Questions</h1>
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          Quick answers to common questions about using Algorand micro-payments, burner wallets, and building machine-payable AI pipelines.
        </p>

        <div className="space-y-12 text-slate-800">
          <section>
            <h2 id="general" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">General Questions</h2>
            <div className="space-y-6">
              <div>
                <h3 id="what-is-x402" className="text-[17px] font-bold text-slate-900 mb-2">What is the x402 Protocol?</h3>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  x402 is an extension of the standard HTTP `402 Payment Required` code. It maps API calls directly to smart contracts on the Algorand blockchain, allowing autonomous AI agents to negotiate prices and pay for computation programmatically.
                </p>
              </div>

              <div>
                <h3 id="burner-wallets" className="text-[17px] font-bold text-slate-900 mb-2">Are burner wallets secure?</h3>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Yes. Burner wallets are designed for isolation. They live in your local browser cache and should only be funded with tiny amounts of utility tokens. Your primary or creator wallets are kept entirely separate.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 id="payments" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Billing & Payments</h2>
            <div className="space-y-6">
              <div>
                <h3 id="refunds" className="text-[17px] font-bold text-slate-900 mb-2">Can I get a refund for failed API calls?</h3>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Since transactions are settled immediately on-chain, all settlements are final. However, Sentinal's SDK client automatically catches errors and will only execute on-chain payments if the challenge details match successfully.
                </p>
              </div>

              <div>
                <h3 id="network-fees" className="text-[17px] font-bold text-slate-900 mb-2">What are the transaction fees?</h3>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Every payout or call logs event relies on standard Algorand network fees (typically 0.001 ALGO per transaction).
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">On this Page</h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a href="#general" onClick={(e) => handleClick(e, 'general')} className={navLinkClass("general")}>
                General FAQ
              </a>
              <ul className="pl-4 mt-1 space-y-1">
                <li><a href="#what-is-x402" onClick={(e) => handleClick(e, 'what-is-x402')} className={navLinkClass("what-is-x402")}>What is x402?</a></li>
                <li><a href="#burner-wallets" onClick={(e) => handleClick(e, 'burner-wallets')} className={navLinkClass("burner-wallets")}>Burner Security</a></li>
              </ul>
            </li>
            <li>
              <a href="#payments" onClick={(e) => handleClick(e, 'payments')} className={navLinkClass("payments")}>
                Billing & Fees
              </a>
              <ul className="pl-4 mt-1 space-y-1">
                <li><a href="#refunds" onClick={(e) => handleClick(e, 'refunds')} className={navLinkClass("refunds")}>Refund Policy</a></li>
                <li><a href="#network-fees" onClick={(e) => handleClick(e, 'network-fees')} className={navLinkClass("network-fees")}>Network Fees</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
