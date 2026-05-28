import React, { useEffect, useState } from "react";

export default function HowItWorks() {
  const [activeId, setActiveId] = useState("");

  // Simple scrollspy for the right sidebar
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
      // Offset for fixed header
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
      {/* Center content */}
      <div className="flex-1 max-w-4xl px-8 py-10 lg:px-12 mx-auto min-h-screen pb-32">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">How SentinelAI Works</h1>
        
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          SentinelAI is a decentralized, pay-per-usage AI gateway built on Algorand. It fundamentally changes how users and AI agents interact with premium API services by eliminating the need for subscriptions, credit card holds, and restrictive API keys.
        </p>

        <div className="space-y-12 text-slate-800">
          
          {/* Section: Why it Works */}
          <section>
            <h2 id="why-it-works" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Why It Works</h2>
            <div className="relative overflow-hidden bg-slate-50 text-slate-900 rounded-xl p-8 border border-slate-200">
              <div className="relative flex flex-col md:flex-row items-start gap-6">
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight">The Problem with Subscriptions</h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed">
                    Today, accessing high-quality AI models requires $20/month subscriptions to multiple providers (ChatGPT Plus, Claude Pro, etc.). If you only need a few queries a day, you end up overpaying drastically. Furthermore, AI agents that need to use tools autonomously have no way to hold a credit card or pay for compute.
                  </p>
                  <h3 className="text-xl font-semibold tracking-tight mt-6">The Solution: Microtransactions</h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed">
                    By combining Algorand's sub-cent transaction fees with the HTTP <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[12px]">402 Payment Required</code> protocol, SentinelAI allows you to pay for AI services **exactly per token used**. You load a few dollars worth of ALGO into a local Burner Wallet, and the system seamlessly handles the micro-payments in the background.
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100">
                  <span className="material-symbols-outlined text-4xl text-indigo-500">payments</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Core Features */}
          <section>
            <h2 id="core-features" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">What Things It Has (Core Features)</h2>
            <div className="grid gap-6 md:grid-cols-2">
              
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">wallet</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">Browser Burner Wallets</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Every user gets a secure, non-custodial local wallet right in their browser. It automatically signs x402 payment transactions in the background without constant annoying popups.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">handshake</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">x402 Protocol</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  A standardized HTTP handshake that allows API endpoints to decline free requests, demand a specific ALGO payment, and verify that payment on-chain before returning data.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">storefront</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">AI Marketplace</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Developers can wrap their existing API keys (OpenAI, Anthropic, Groq) or custom fine-tunes in a SentinelAI proxy endpoint. They set a markup price and earn ALGO directly from users.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">developer_board</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">Sentinel Studio</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  A suite of creative tools (Blogging Agent, ClipCraft, AI Chat, Data Analyst) that seamlessly consume the AI services from the Marketplace, paying per-use in the background.
                </p>
              </div>

            </div>
          </section>

        </div>
      </div>

      {/* Right sidebar (On this page) */}
      <div className="w-64 shrink-0 hidden xl:block border-l border-slate-200 h-[calc(100vh-56px)] overflow-y-auto bg-slate-50/50 sticky top-14">
        <div className="px-6 py-8">
          <h5 className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider mb-4">
            On this page
          </h5>
          <nav className="space-y-1 border-l-2 border-slate-200 ml-[1px]">
            <a
              href="#why-it-works"
              onClick={(e) => handleClick(e, "why-it-works")}
              className={navLinkClass("why-it-works")}
            >
              Why It Works
            </a>
            <a
              href="#core-features"
              onClick={(e) => handleClick(e, "core-features")}
              className={navLinkClass("core-features")}
            >
              Core Features
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}
