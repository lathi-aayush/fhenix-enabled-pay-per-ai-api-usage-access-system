import React, { useEffect, useState } from "react";

export default function HowItWorks() {
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
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">
          How SentinalAI Works
        </h1>

        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          SentinalAI is a decentralized, pay-per-usage AI gateway on Algorand. Users and autonomous
          agents access premium models without subscriptions, credit-card billing, or shared API keys —
          every call is priced transparently and settled on-chain.
        </p>

        <div className="space-y-12 text-slate-800">
          <section>
            <h2
              id="overview"
              className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2"
            >
              Overview
            </h2>
            <div className="relative overflow-hidden bg-slate-50 text-slate-900 rounded-xl p-8 border border-slate-200">
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    Pay-per-use · On-chain · Agent-ready
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">
                    A marketplace and studio for machine-native AI
                  </h3>
                  <p className="text-[14px] text-slate-600 max-w-2xl leading-relaxed">
                    Creators publish AI services wrapped behind Sentinal&apos;s secure proxy. Users pay
                    in ALGO per call — peer-to-peer, directly to the creator&apos;s wallet. Sentinal
                    Studio adds creative workflows (blogging, clips, chat) that consume those same
                    services natively, with micro-payments handled in the background.
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100">
                  <span className="material-symbols-outlined text-4xl text-indigo-500">hub</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2
              id="why-it-works"
              className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2"
            >
              Why It Works
            </h2>
            <div className="relative overflow-hidden bg-slate-50 text-slate-900 rounded-xl p-8 border border-slate-200">
              <div className="relative flex flex-col md:flex-row items-start gap-6">
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight">
                    The problem with subscriptions
                  </h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed">
                    High-quality AI today usually means $20/month plans across multiple providers.
                    Light usage overpays; heavy usage hits rate limits. Autonomous agents cannot hold
                    credit cards or manage dozens of API keys — they need a payment layer built for
                    software, not humans.
                  </p>
                  <h3 className="text-xl font-semibold tracking-tight mt-6">
                    The solution: microtransactions + HTTP 402
                  </h3>
                  <p className="text-[14px] text-slate-600 leading-relaxed">
                    Algorand confirms payments in seconds with sub-cent fees — ideal for per-token
                    billing. Combined with the{" "}
                    <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[12px]">
                      402 Payment Required
                    </code>{" "}
                    challenge-response standard (x402), APIs can demand an exact ALGO amount, verify
                    it on-chain, and return data in one transparent handshake. The result is a true
                    machine-to-machine economy: no subscriptions, no platform custody of funds.
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100">
                  <span className="material-symbols-outlined text-4xl text-indigo-500">payments</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mt-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h4 className="font-semibold text-slate-900 text-[15px]">Request a service</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Browse the marketplace or call an x402 endpoint. The backend runs the model and
                  quotes an exact ALGO charge from token usage.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h4 className="font-semibold text-slate-900 text-[15px]">Pay on-chain</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Sign a micro-payment with Pera Wallet or a local burner wallet. ALGO goes directly
                  from user to creator — peer-to-peer.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h4 className="font-semibold text-slate-900 text-[15px]">Receive the response</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Sentinal verifies the transaction on the Algorand indexer, logs usage, and returns
                  the AI output — plus an optional proof-of-intelligence attestation on-chain.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2
              id="core-features"
              className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2"
            >
              Core Features
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">wallet</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">Burner Wallets</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Each user gets a secure, non-custodial hot wallet in the browser. Fund it once with
                  a small ALGO balance; the app signs micro-payments automatically — no popup on every
                  API call. The mnemonic can be encrypted and synced to your profile for programmatic
                  clients.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">handshake</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">x402 Handshake</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  A standardized HTTP flow: the server returns{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[12px]">402</code>{" "}
                  with price and pay-to address; the client signs, retries with{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[12px]">
                    X-Payment
                  </code>
                  , and receives the resource. Transparent pricing for humans and agents alike.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">developer_board</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">AI Studio</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  A suite of creative tools — Blogging Agent, ClipCraft, Studio Chat, Workflow Studio,
                  and more — that consume marketplace AI natively. Generate content, schedule
                  publishing, and run visual workflows while pay-per-use billing runs in the
                  background.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">storefront</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-[16px]">The Marketplace</h4>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed">
                  Creators wrap models from Groq, OpenAI, Anthropic, or Together behind Sentinal&apos;s
                  proxy. They set per-1K-token pricing and a minimum charge; provider keys stay
                  AES-encrypted. Revenue lands in their Algorand wallet on every verified call — no
                  payout delays.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2
              id="developer-sdk"
              className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2"
            >
              Developer SDK
            </h2>
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-8 border border-indigo-950 shadow-sm">
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200">
                    NPM Package · @sentinalapi/sdk
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">
                    Integrate Pay-Per-Use AI in Minutes
                  </h3>
                  <p className="text-[14px] text-indigo-200 leading-relaxed">
                    Build client-side or server-side applications that communicate directly with the Sentinal AI gateway. 
                    The SDK abstracts the complete three-phase payment flow (invoke, pay, complete) into a single, seamless 
                    <code className="bg-indigo-900/60 px-1 py-0.5 rounded font-mono text-white text-[12px] mx-1">client.chat()</code> method.
                  </p>
                  <div className="pt-2">
                    <a
                      href="/sdk-demo"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-indigo-200 transition-colors"
                    >
                      Explore Interactive SDK Demo →
                    </a>
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-800/40 border border-indigo-700/50">
                  <span className="material-symbols-outlined text-4xl text-indigo-300">integration_instructions</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">
          On this Page
        </h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a
                href="#overview"
                onClick={(e) => handleClick(e, "overview")}
                className={navLinkClass("overview")}
              >
                Overview
              </a>
            </li>
            <li>
              <a
                href="#why-it-works"
                onClick={(e) => handleClick(e, "why-it-works")}
                className={navLinkClass("why-it-works")}
              >
                Why It Works
              </a>
            </li>
            <li>
              <a
                href="#core-features"
                onClick={(e) => handleClick(e, "core-features")}
                className={navLinkClass("core-features")}
              >
                Core Features
              </a>
            </li>
            <li>
              <a
                href="#developer-sdk"
                onClick={(e) => handleClick(e, "developer-sdk")}
                className={navLinkClass("developer-sdk")}
              >
                Developer SDK
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
