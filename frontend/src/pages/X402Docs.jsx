import React, { useEffect, useState } from "react";

export default function X402Docs() {
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
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">Getting Started with x402 Protocol</h1>
        
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          Machine-payable API system enabling AI Agents to unlock pay-per-use services autonomously.
          Traditionally, autonomous software agents (LLMs, Langchain instances, or n8n workflow tools) had no way to pay for individual API calls. x402 enables agents to hold their own micro-budgets using secure browser burner wallets, parse standard HTTP 402 challenge-responses, sign payments, and verify on-chain automatically.
        </p>

        <div className="space-y-12 text-slate-800">
          
          {/* Section: Overview */}
          <section>
            <h2 id="overview" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Overview</h2>
            <div className="relative overflow-hidden bg-slate-50 text-slate-900 rounded-xl p-8 border border-slate-200">
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 space-y-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    Keyless Machine-to-Machine Payments
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">AI Agents as First-Class Economic Citizens</h3>
                  <p className="text-[14px] text-slate-600 max-w-2xl leading-relaxed">
                    x402 acts as a standard for agents to programmatically negotiate API fees using crypto. By tying microtransactions to ALGO, it circumvents credit card limits, subscriptions, and API key management completely.
                  </p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100">
                  <span className="material-symbols-outlined text-4xl text-indigo-500">support_agent</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Handshake */}
          <section>
            <h2 id="handshake" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">The x402 Challenge-Response Handshake</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">1</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">HTTP 402 Challenge</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  The agent calls the gated endpoint without payment. The server intercepts the request and responds with <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[12px]">402 Payment Required</code> containing the creator's wallet address and fixed ALGO cost.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">2</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">Automated Signing</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  The agent library uses its local burner private key to sign a payment transaction, broadcasting it immediately to the Algorand blockchain.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">3</div>
                <h4 className="font-semibold text-slate-900 text-[15px]">Verification & 200 OK</h4>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Once confirmed, the agent packages the transaction into the <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[12px]">X-Payment</code> header and retries. Server verifies on-chain and returns the AI completion.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Creators */}
          <section>
            <h2 id="creators" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">How to Apply: Creator Monetization</h2>
            <ul className="space-y-4 text-[14px] text-slate-700 leading-relaxed list-disc pl-5">
              <li>
                <strong>Opt-In Services:</strong> Navigate to your Creator dashboard, select any API service you created, and toggle <strong>Enable x402 Access</strong>.
              </li>
              <li>
                <strong>Declare Minimum Pricing:</strong> The system automatically uses the service's minimum charge rate as the fixed per-call fee.
              </li>
              <li>
                <strong>On-Chain Revenue:</strong> Payments are verified directly on the Algorand blockchain and land directly in your wallet without middleman delays or payout requests.
              </li>
            </ul>
          </section>

          {/* Section: Security */}
          <section>
            <h2 id="security" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Trust, Sandboxing & Security</h2>
            <ul className="space-y-4 text-[14px] text-slate-700 leading-relaxed list-disc pl-5">
              <li>
                <strong>Replay Prevention:</strong> The backend verifies transaction hash uniqueness. Once a transaction is validated, the same ID can never be used again.
              </li>
              <li>
                <strong>Absolute Isolation:</strong> Agent burner wallets are isolated. They are loaded only with small amounts of utility tokens, protecting primary funds.
              </li>
              <li>
                <strong>Decentralized Indexing:</strong> Real-time ledger lookup ensures trustless authentication. Sentinel checks the Algorand indexer node directly.
              </li>
            </ul>
          </section>

          {/* Section: Agent Workflows */}
          <section>
            <h2 id="agents" className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Agent Workflows</h2>
            <p className="text-[14px] text-slate-600 mb-6 leading-relaxed">
              Learn how to build autonomous agents that can fund their own execution, purchase access to APIs seamlessly, and operate without centralized credit card billing. The x402 system ensures your agents can buy knowledge and computation on the fly.
            </p>
            
            <div className="space-y-8">
              <div>
                <h3 id="langchain" className="text-[17px] font-semibold text-slate-900 mb-3">Langchain Integration</h3>
                <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
                  You can wrap the x402 payment flow directly into a custom Langchain tool. When the LLM decides it needs data from a gated API, the tool catches the 402, parses the cost, signs the transaction with its local burner wallet, and returns the successfully purchased data to the context window.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 overflow-x-auto">
                  <pre className="text-[13px] text-slate-800 font-mono leading-relaxed">
{`from langchain.tools import BaseTool

class X402APITool(BaseTool):
    name = "x402_api_caller"
    description = "Use this to fetch data from x402 protected APIs"
    
    def _run(self, url: str, query: str):
        # 1. Make initial request
        # 2. Catch 402 Payment Required
        # 3. Sign ALGO transaction
        # 4. Retry with X-Payment header
        return fetch_with_payment(url, query, local_wallet)`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 id="n8n" className="text-[17px] font-semibold text-slate-900 mb-3">n8n & Workflow Automation</h3>
                <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
                  For visual builders, x402 can be integrated as a custom n8n node. This allows you to build complex automation pipelines where certain steps autonomously pay for themselves based on the value they provide, completely eliminating API key sharing and centralized billing bottlenecks.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 overflow-x-auto">
                  <pre className="text-[13px] text-slate-800 font-mono leading-relaxed">
{`// Pseudo-code for n8n custom node
async execute(this: IExecuteFunctions) {
    const url = this.getNodeParameter("url");
    try {
        const response = await this.helpers.request(url);
        return response;
    } catch(error) {
        if(error.statusCode === 402) {
            const tx = await signAlgorandTx(error.headers['x-cost']);
            return await this.helpers.request(url, {
                headers: { 'X-Payment': tx.id }
            });
        }
    }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Right Sidebar (On this Page) */}
      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">On this Page</h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a href="#overview" onClick={(e) => handleClick(e, 'overview')} className={navLinkClass("overview")}>
                Overview
              </a>
            </li>
            <li>
              <a href="#handshake" onClick={(e) => handleClick(e, 'handshake')} className={navLinkClass("handshake")}>
                Challenge-Response Handshake
              </a>
            </li>
            <li>
              <a href="#creators" onClick={(e) => handleClick(e, 'creators')} className={navLinkClass("creators")}>
                Creator Monetization
              </a>
            </li>
            <li>
              <a href="#security" onClick={(e) => handleClick(e, 'security')} className={navLinkClass("security")}>
                Trust & Security
              </a>
            </li>
            <li>
              <a href="#agents" onClick={(e) => handleClick(e, 'agents')} className={navLinkClass("agents")}>
                Agent Workflows
              </a>
              <ul className="pl-4 mt-1 space-y-1">
                <li><a href="#langchain" onClick={(e) => handleClick(e, 'langchain')} className={navLinkClass("langchain")}>Langchain Integration</a></li>
                <li><a href="#n8n" onClick={(e) => handleClick(e, 'n8n')} className={navLinkClass("n8n")}>n8n Workflow</a></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
