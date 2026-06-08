import React, { useEffect, useState } from "react";

export default function WithdrawalDocs() {
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
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">Creator Payouts & Withdrawals</h1>
        
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          How Sentinal settles metered API earnings and handles on-chain creator withdrawals.
          Sentinal operates on a decentralized, peer-to-peer micro-payment system. However, to accommodate platform routing, subscription pooling, and escrow payouts, the platform provides a **custodial vault system** where accumulated creator earnings are held in the secure Sentinal treasury and can be withdrawn on-chain on demand.
        </p>

        <div className="space-y-12 text-slate-800">
          
          {/* Section: Overview */}
          <section>
            <h2 id="overview" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Overview</h2>
            <div className="relative overflow-hidden bg-slate-50 text-slate-900 rounded-xl p-8 border border-slate-200">
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    On-Chain Settlement
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">Accrued Balance to Linked Wallet</h3>
                  <p className="text-[14px] text-slate-600 max-w-2xl leading-relaxed">
                    When customers consume your endpoints, the platform routes a portion of their pay-per-use fees into the Sentinal vault. The Creator Withdrawal Dashboard aggregates these earnings and releases them directly to your linked Pera Wallet with a single click.
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 border border-emerald-100">
                  <span className="material-symbols-outlined text-4xl text-emerald-500">payments</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Mechanics */}
          <section>
            <h2 id="mechanics" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Withdrawal Mechanics</h2>
            <p className="text-[14px] text-slate-600 mb-6 leading-relaxed">
              Your withdrawable balance is calculated in real-time by checking your cumulative service statistics against your past withdrawal history:
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">1</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">1. Total Earned</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Sum of all ALGO payments verified from successful API calls on your services. This matches your accumulated platform logs.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">2</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">2. Total Withdrawn</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  The cumulative sum of all your completed withdrawal requests. This represents funds already transferred on-chain to your linked address.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">3</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">3. Withdrawable</h4>
                <p className="text-[13px] text-emerald-800 font-medium leading-relaxed">
                  Calculated as: <code className="bg-slate-50 px-1 py-0.5 rounded font-mono text-[11px]">Total Earned - Total Withdrawn - Pending Requests</code>. This is the net balance ready to be claimed.
                </p>
              </div>
            </div>
          </section>

          {/* Section: API Reference */}
          <section>
            <h2 id="api" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">API Reference</h2>
            
            <h3 id="get-withdrawals" className="text-lg font-semibold text-slate-900 mt-6 mb-3">GET /api/creator/withdrawals</h3>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Returns withdrawal stats and recent withdrawal transactions. Requires creator authentication.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-normal">
{`// Headers:
// Authorization: Bearer <JWT_TOKEN>

// Response:
{
  "totalEarned": 1.062505,
  "totalWithdrawn": 0.5,
  "withdrawable": 0.562505,
  "pendingWithdrawals": 0,
  "minWithdrawalAlgo": 0.1,
  "creatorWallet": "ICM4Y4YVJWSBOV4LQIBXYVTHF2NDOJSUAPTX2DE4HQTPVDS5ZQCXP3MHLI",
  "withdrawals": [
    {
      "id": "66a8cf218...",
      "amountAlgo": 0.5,
      "status": "completed",
      "txId": "K2YVJX...",
      "createdAt": "2026-05-31T07:15:35.000Z"
    }
  ]
}`}
            </pre>

            <h3 id="post-withdraw" className="text-lg font-semibold text-slate-900 mt-8 mb-3">POST /api/creator/withdraw</h3>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Submits a request to withdraw funds on-chain. Triggers an atomic payment transaction on Algorand TestNet.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-normal">
{`// Headers:
// Authorization: Bearer <JWT_TOKEN>
// Content-Type: application/json

// Request Body:
{
  "amount": 0.5
}

// Success Response (201 Created):
{
  "withdrawal": {
    "id": "66a8cf218...",
    "amountAlgo": 0.5,
    "status": "completed",
    "txId": "K2YVJX...",
    "createdAt": "2026-05-31T07:22:12.000Z"
  },
  "totalEarned": 1.062505,
  "totalWithdrawn": 1.0,
  "pendingWithdrawals": 0,
  "withdrawable": 0.062505
}`}
            </pre>
          </section>

          {/* Section: Integration */}
          <section>
            <h2 id="integration" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Programmatic Integration</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Developers can automate creator payouts using the following Axios integration script:
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-normal">
{`import axios from "axios";

async function requestPayout(jwtToken, amount) {
  try {
    const { data } = await axios.post(
      "http://localhost:5000/api/creator/withdraw",
      { amount },
      {
        headers: {
          Authorization: \`Bearer \${jwtToken}\`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Withdrawal processing completed!", data.withdrawal.txId);
    return data.withdrawal;
  } catch (error) {
    console.error("Payout request failed:", error.response?.data?.error || error.message);
    throw error;
  }
}`}
            </pre>
          </section>

        </div>
      </div>

      {/* Right Table of Contents */}
      <div className="w-64 shrink-0 hidden lg:block border-l border-slate-200 h-[calc(100vh-56px)] overflow-y-auto bg-slate-50/50 sticky top-14">
        <div className="px-6 py-10">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">On this page</p>
          <nav className="space-y-1 font-medium text-slate-600 border-l border-slate-200">
            <a href="#overview" onClick={(e) => handleClick(e, "overview")} className={navLinkClass("overview")}>
              Overview
            </a>
            <a href="#mechanics" onClick={(e) => handleClick(e, "mechanics")} className={navLinkClass("mechanics")}>
              Withdrawal Mechanics
            </a>
            <a href="#api" onClick={(e) => handleClick(e, "api")} className={navLinkClass("api")}>
              API Reference
            </a>
            <a href="#integration" onClick={(e) => handleClick(e, "integration")} className={navLinkClass("integration")}>
              Programmatic Integration
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}
