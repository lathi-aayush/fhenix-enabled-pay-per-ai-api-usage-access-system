import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import MegaNav from "../components/MegaNav.jsx";

const INSTALL_CMD = "npm install @sentinalapi/sdk algosdk";

const CODE_SNIPPETS = {
  node: {
    label: "Node.js",
    lang: "TypeScript",
    icon: "terminal",
    code: `import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY,  // sk-sentinel-...
  baseUrl: "https://your-sentinel-api.example",
  network: "testnet",
});

// Server-side signing — never expose mnemonic in browser
const signer = new MnemonicSigner(process.env.ALGORAND_MNEMONIC);

const response = await client.chat(
  [{ role: "user", content: "Explain Algorand briefly." }],
  signer
);

console.log(SentinelClient.getAssistantText(response));
// → "Algorand is a pure proof-of-stake blockchain..."

console.log(response.sentinelReceipt);
// → { paymentTxId: "ABCD...", chargeAlgo: 0.001, totalTokens: 38 }`,
  },
  browser: {
    label: "Browser + Pera",
    lang: "TypeScript",
    icon: "account_balance_wallet",
    code: `import { PeraWalletConnect } from "@perawallet/connect";
import { BYOSigner, SentinelClient } from "@sentinalapi/sdk";

const pera = new PeraWalletConnect();
const [address] = await pera.connect();

const client = new SentinelClient({
  apiKey: "sk-sentinel-...",
  baseUrl: "https://your-api.example.com",
  network: "testnet",
});

// BYOSigner: plug in any wallet — Pera, Defly, or raw algosdk
const signer = new BYOSigner(address, async (txn) => {
  const signed = await pera.signTransaction([[{ txn }]]);
  return signed[0]; // Uint8Array
});

const response = await client.chat(
  [{ role: "user", content: "Hello from the browser!" }],
  signer
);

console.log(SentinelClient.getAssistantText(response));`,
  },
  manual: {
    label: "Manual Flow",
    lang: "TypeScript",
    icon: "tune",
    code: `import {
  buildPaymentTx,
  submitSignedPayment,
  SentinelClient,
} from "@sentinalapi/sdk";

const client = new SentinelClient({ apiKey, network: "testnet" });

// Phase 1 — get AI response + payment quote
const quote = await client.invoke([
  { role: "user", content: "Hello!" }
]);
console.log(\`Pay \${quote.chargeAlgo} ALGO to \${quote.developerWallet}\`);

// Phase 2 — build, sign, submit the Algorand payment
const txn = await buildPaymentTx({
  from: signer.address,
  to: quote.developerWallet,
  microAlgos: quote.expectedMicroAlgos,
  paymentRef: quote.paymentRef, // ← goes in txn note
  algodClient: client.algodClient,
});
const signed = await signer.sign(txn);
const txId = await submitSignedPayment({
  signedTxn: signed,
  algodClient: client.algodClient,
});

// Phase 3 — unlock AI response after on-chain verification
const response = await client.complete(quote.paymentRef, txId);
console.log(SentinelClient.getAssistantText(response));`,
  },
  nextjs: {
    label: "Next.js",
    lang: "TypeScript",
    icon: "web",
    code: `// app/api/ask/route.ts — Next.js App Router server action
import { MnemonicSigner, SentinelClient } from "@sentinalapi/sdk";
import { NextResponse } from "next/server";

const client = new SentinelClient({
  apiKey: process.env.SENTINEL_API_KEY!,
  baseUrl: process.env.SENTINEL_BASE_URL!,
  network: "testnet",
});

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const signer = new MnemonicSigner(process.env.ALGORAND_MNEMONIC!);

  const response = await client.chat(
    [{ role: "user", content: prompt }],
    signer
  );

  return NextResponse.json({
    answer: SentinelClient.getAssistantText(response),
    receipt: response.sentinelReceipt,
  });
}`,
  },
};

const ERRORS = [
  { name: "SentinelAuthError", http: "401", desc: "Bad or missing API key" },
  { name: "SentinelPaymentError", http: "402", desc: "Payment not verified" },
  { name: "SentinelSessionExpired", http: "410", desc: "Quote expired (>60s)" },
  { name: "SentinelUpstreamError", http: "502", desc: "AI provider failed" },
  { name: "SentinelNetworkError", http: "—", desc: "Fetch / timeout failure" },
];

const FLOW_STEPS = [
  {
    num: "01",
    icon: "send",
    title: "Invoke",
    desc: "Send your prompt → AI runs → receive a payment quote with chargeAlgo and paymentRef",
  },
  {
    num: "02",
    icon: "account_balance_wallet",
    title: "Pay on Algorand",
    desc: "SDK signs a micro-payment transaction and submits it to the Algorand network",
  },
  {
    num: "03",
    icon: "verified",
    title: "Complete",
    desc: "Server verifies payment on-chain and releases the AI response + on-chain receipt",
  },
];

function useIntersection(ref, options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1, ...options });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return isVisible;
}

export default function SdkDemo() {
  const [activeTab, setActiveTab] = useState("node");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const flowRef = useRef(null);
  const errorsRef = useRef(null);
  const flowVisible = useIntersection(flowRef);
  const errorsVisible = useIntersection(errorsRef);

  function copyInstall() {
    navigator.clipboard.writeText(INSTALL_CMD).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    navigator.clipboard.writeText(CODE_SNIPPETS[activeTab].code).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  const snippet = CODE_SNIPPETS[activeTab];

  return (
    <div className="antialiased min-h-screen bg-white">
      <MegaNav />

      {/* ── Hero ───────────────────────────────────── */}
      <section className="pt-28 pb-16 px-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-br from-indigo-500/8 via-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[300px] bg-indigo-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            Developer SDK — v1.0.0 · TypeScript + ESM + CJS
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight font-headline">
            Build with{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              @sentinalapi/sdk
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            The official JavaScript SDK for pay-per-use AI APIs on Algorand. One method.
            Full TypeScript types. Works in Node.js, browsers, and Next.js.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <a
              href="https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/tree/main/sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#031634] text-white rounded-full text-sm font-semibold hover:bg-[#0a2855] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">code</span>
              View on GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@sentinalapi/sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-800 rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">package_2</span>
              npm package
            </a>
          </div>
        </div>
      </section>

      {/* ── Install ─────────────────────────────────── */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
            {/* Title bar dots */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-800">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-slate-500 font-mono">Terminal</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <code className="text-sm font-mono text-emerald-400 flex-1">
                <span className="text-slate-500 select-none">$ </span>
                {INSTALL_CMD}
              </code>
              <button
                type="button"
                onClick={copyInstall}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works flow ───────────────────────── */}
      <section className="px-6 pb-16" ref={flowRef}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-8 text-center">
            How the payment flow works
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FLOW_STEPS.map((step, i) => (
              <div
                key={step.num}
                style={{
                  opacity: flowVisible ? 1 : 0,
                  transform: flowVisible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
                }}
                className="relative bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
              >
                <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-300 font-mono">
                  {step.num}
                </div>
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-indigo-600 text-[20px]">
                    {step.icon}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code Examples ───────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Code Examples</h2>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-0">
            {Object.entries(CODE_SNIPPETS).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">{val.icon}</span>
                {val.label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="bg-slate-950 rounded-b-2xl rounded-tr-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <span className="text-xs text-slate-400 font-mono">{snippet.lang}</span>
              <button
                type="button"
                onClick={copyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">
                  {codeCopied ? "check" : "content_copy"}
                </span>
                {codeCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-5 text-[12.5px] leading-[1.7] overflow-x-auto text-slate-300 font-mono whitespace-pre">
              {snippet.code}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Error classes ───────────────────────────── */}
      <section className="px-6 pb-16" ref={errorsRef}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Typed Error Classes</h2>
          <p className="text-sm text-slate-500 mb-6">
            Every failure throws a typed subclass — catch exactly what you need.
          </p>
          <div className="overflow-hidden border border-slate-200 rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">HTTP</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                </tr>
              </thead>
              <tbody>
                {ERRORS.map((e, i) => (
                  <tr
                    key={e.name}
                    style={{
                      opacity: errorsVisible ? 1 : 0,
                      transition: `opacity 0.4s ease ${i * 0.08}s`,
                    }}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <code className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {e.name}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{e.http}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Links grid ──────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Documentation</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "rocket_launch", title: "Quickstart", sub: "Get running in 5 min", to: null, href: "https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/blob/main/sdk/docs/quickstart.md" },
              { icon: "menu_book", title: "API Reference", sub: "Full SentinelClient docs", to: null, href: "https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/blob/main/sdk/docs/api-reference.md" },
              { icon: "error_outline", title: "Error Handling", sub: "Typed error hierarchy", to: null, href: "https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/blob/main/sdk/docs/error-handling.md" },
              { icon: "account_balance_wallet", title: "Wallet Guides", sub: "Pera, Defly & more", to: null, href: "https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/blob/main/sdk/docs/algorand-wallets.md" },
            ].map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group p-5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all duration-200"
              >
                <div className="w-9 h-9 bg-indigo-50 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">{item.icon}</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA footer ──────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-10 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="sdk-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#sdk-grid)" />
              </svg>
            </div>
            <div className="relative">
              <h2 className="text-2xl font-bold text-white mb-2">Ready to build?</h2>
              <p className="text-indigo-200 text-sm mb-6">
                Get your API key from the marketplace and make your first on-chain AI call in minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/marketplace/browse"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-full text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                  Browse APIs
                </Link>
                <a
                  href="https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/tree/main/sdk"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500/40 text-white border border-white/20 rounded-full text-sm font-semibold hover:bg-indigo-500/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  SDK on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
