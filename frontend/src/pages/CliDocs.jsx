import React, { useEffect, useState } from "react";

export default function CliDocs() {
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
          <span className="text-slate-600 font-semibold">CLI Tool</span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-6 tracking-tight">Sentinal Command Line Interface (CLI)</h1>
        <p className="text-[15px] text-slate-600 mb-8 leading-relaxed">
          Automate billing smart contract deployments, check wallet balances, and monitor machine-payable transaction feeds directly from your local terminal.
        </p>

        <div className="space-y-12 text-slate-800">
          <section>
            <h2 id="installation" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Installation</h2>
            
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs leading-relaxed">
              <div className="font-semibold mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">info</span>
                Private Preview Status
              </div>
              The global CLI package <code>@sentinalapi/cli</code> is currently in private preview and is not yet published to the public npm registry. To deploy or interact with the smart contract, please use the local Python deployment scripts in <code>/contract</code> or integrate the JS/TS SDK in the <code>/sdk</code> folder.
            </div>

            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Install the CLI globally using npm or yarn once released:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-[13px] text-slate-800">
              npm install -g @sentinalapi/cli
            </div>
          </section>

          <section>
            <h2 id="commands" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Commands</h2>
            <div className="space-y-6">
              <div>
                <h3 id="cmd-deploy" className="text-[17px] font-bold text-slate-900 mb-2">sentinal deploy</h3>
                <p className="text-[14px] text-slate-600 mb-3 leading-relaxed">
                  Compile and deploy a new pay-per-usage billing smart contract to the Algorand blockchain.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-[13px] text-slate-800">
                  sentinal deploy --network testnet --mnemonic "your mnemonic phrase..."
                </div>
              </div>

              <div>
                <h3 id="cmd-balance" className="text-[17px] font-bold text-slate-900 mb-2">sentinal balance</h3>
                <p className="text-[14px] text-slate-600 mb-3 leading-relaxed">
                  Query the balance of your developer account or burner wallet.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-[13px] text-slate-800">
                  sentinal balance --address "ALGO_ADDRESS..."
                </div>
              </div>

              <div>
                <h3 id="cmd-monitor" className="text-[17px] font-bold text-slate-900 mb-2">sentinal monitor</h3>
                <p className="text-[14px] text-slate-600 mb-3 leading-relaxed">
                  Listen to real-time machine-to-machine transactions and on-chain payouts.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-[13px] text-slate-800">
                  sentinal monitor --app-id 1081
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 id="configuration" className="text-2xl font-bold tracking-tight text-slate-900 mb-4 border-b border-slate-100 pb-2">Configuration</h2>
            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Store your credentials locally by creating a configuration file at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[12px]">~/.sentinal/config.json</code>:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 overflow-x-auto">
              <pre className="text-[13px] text-slate-800 font-mono leading-relaxed">
{`{
  "algod_node": "https://testnet-api.algonode.cloud",
  "indexer_node": "https://testnet-idx.algonode.cloud",
  "default_network": "testnet"
}`}
              </pre>
            </div>
          </section>
        </div>
      </div>

      <div className="w-64 shrink-0 hidden xl:block px-8 py-10 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">On this Page</h4>
        <div className="border-l-2 border-slate-100 pl-3">
          <ul className="space-y-1">
            <li>
              <a href="#installation" onClick={(e) => handleClick(e, 'installation')} className={navLinkClass("installation")}>
                Installation
              </a>
            </li>
            <li>
              <a href="#commands" onClick={(e) => handleClick(e, 'commands')} className={navLinkClass("commands")}>
                CLI Commands
              </a>
              <ul className="pl-4 mt-1 space-y-1">
                <li><a href="#cmd-deploy" onClick={(e) => handleClick(e, 'cmd-deploy')} className={navLinkClass("cmd-deploy")}>sentinal deploy</a></li>
                <li><a href="#cmd-balance" onClick={(e) => handleClick(e, 'cmd-balance')} className={navLinkClass("cmd-balance")}>sentinal balance</a></li>
                <li><a href="#cmd-monitor" onClick={(e) => handleClick(e, 'cmd-monitor')} className={navLinkClass("cmd-monitor")}>sentinal monitor</a></li>
              </ul>
            </li>
            <li>
              <a href="#configuration" onClick={(e) => handleClick(e, 'configuration')} className={navLinkClass("configuration")}>
                Configuration
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
