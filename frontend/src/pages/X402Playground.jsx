import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { getPublicApiBase } from "../utils/apiBase.js";

// Helper to generate UUID-like values
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function X402Playground() {
  const [stage, setStage] = useState("idle"); // idle, sending_initial, challenge_402, signing_tx, ledger_sync, verified_200, completed
  const [prompt, setPrompt] = useState("Write a 1-sentence tagline for a decentralized AI marketplace.");
  const [aiProvider, setAiProvider] = useState("groq");
  const [modelName, setModelName] = useState("llama-3.3-70b");
  const [priceAlgo, setPriceAlgo] = useState("0.005");
  const [latency, setLatency] = useState(1.2); // mock network delay in seconds
  const [simulationLogs, setSimulationLogs] = useState([]);
  
  // Custom mock values generated per simulation run
  const [paymentRef, setPaymentRef] = useState("");
  const [txId, setTxId] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  
  const apiBase = getPublicApiBase();
  const mockEndpoint = `${apiBase}/api/x402/use/srv_mock123`;
  
  const providers = {
    groq: { label: "Groq", models: ["llama-3.3-70b", "mixtral-8x7b"] },
    openai: { label: "OpenAI", models: ["gpt-4o-mini", "o3-mini"] },
    anthropic: { label: "Anthropic", models: ["claude-3-5-sonnet", "claude-3-haiku"] },
  };

  useEffect(() => {
    // Sync default model when provider changes
    setModelName(providers[aiProvider].models[0]);
  }, [aiProvider]);

  const addLog = (message, type = "info", details = null) => {
    setSimulationLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), message, type, details }]);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function runSimulation() {
    if (!prompt.trim()) {
      toast.error("Please enter a mock prompt!");
      return;
    }
    
    // Reset state
    setSimulationLogs([]);
    setPaymentRef(generateUUID());
    setTxId("tx_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    setAiResponse("");
    
    // --- STAGE 1: SENDING INITIAL REQUEST ---
    setStage("sending_initial");
    addLog("Client initiated keyless HTTP POST request to Sentinel gateway...", "send");
    addLog(`POST ${mockEndpoint}`, "header", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prompt, provider: aiProvider, model: modelName }),
    });
    
    await sleep(1500);

    // --- STAGE 2: 402 CHALLENGE ---
    setStage("challenge_402");
    addLog("Sentinel Server intercepted request: No authorization key or payment txn provided.", "warn");
    addLog("Server responded with HTTP 402 (Payment Required) + settlement parameters.", "receive");
    addLog("HTTP/1.1 402 Payment Required", "header", {
      headers: {
        "X-Payment-Destination": "AGQYRQPXUTEL... (Creator's Wallet)",
        "X-Payment-Amount-MicroAlgos": String(Number(priceAlgo) * 1e6),
        "X-Payment-Reference": paymentRef,
        "X-Payment-Block-Threshold": "1000",
      },
      body: JSON.stringify({
        error: "Payment Required",
        message: "This endpoint requires an on-chain micropayment. Auto-pay using standard x402 headers.",
      }),
    });

    await sleep(2200);

    // --- STAGE 3: SIGNING TX ---
    setStage("signing_tx");
    addLog("Client-side agent parsed 402 headers: extracted amount, destination, and payment reference.", "info");
    addLog("Client's local Burner Wallet initialized cryptographically to sign micropayment.", "info");
    addLog(`Generating Algorand transaction...`, "info");
    addLog(`Transaction signed dynamically by Burner Wallet private key.`, "success");
    addLog("Signed Transaction Object", "header", {
      sender: "BURNER_ADDR_Z4E2... (Self-Custodial Local Wallet)",
      receiver: "AGQYRQPXUTEL... (Creator's Wallet)",
      amountMicroAlgos: String(Number(priceAlgo) * 1e6),
      feeMicroAlgos: "1000",
      note: `sentinel:x402:${paymentRef}`,
      signature: "sig_ed25519_8c3f9104b2a9e102...",
    });

    await sleep(2000);

    // --- STAGE 4: LEDGER SYNC ---
    setStage("ledger_sync");
    addLog(`Broadcasting transaction ${txId.slice(0, 15)}... to Algorand Testnet ledger.`, "send");
    addLog("Waiting for block consensus confirmation...", "info");
    
    await sleep(latency * 1000);
    
    addLog(`Transaction confirmed in Block #4729103! Verified on-chain.`, "success");

    // --- STAGE 5: RETRYING WITH PROOF ---
    setStage("verified_200");
    addLog("Client automatically retried the original API request containing the transaction proof.", "send");
    addLog(`POST ${mockEndpoint}`, "header", {
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Txn-Id": txId,
        "X-Payment-Reference": paymentRef,
      },
      body: JSON.stringify({ prompt, provider: aiProvider, model: modelName }),
    });

    await sleep(1500);

    addLog("Server verified transaction: Checked sender, amount, and reference in indexer records.", "info");
    addLog(`Micropayment valid! Forwarding prompt to ${providers[aiProvider].label} (${modelName}).`, "success");
    
    // Simulate streaming text response
    setStage("completed");
    addLog("Server delivered HTTP 200 (OK) with finalized AI generation content.", "receive");
    addLog("HTTP/1.1 200 OK", "header", {
      headers: {
        "Content-Type": "application/json",
        "X-Sentinel-Billable-Cost-Algo": priceAlgo,
      },
    });

    const answers = [
      `Sentinel is a trustless, decentralized API gateway built to enable developers to call advanced AI models pay-as-you-go using Algorand's sub-second transactions.`,
      `Sentinel bridges AI inference and Web3, enabling zero-subscription API gateways powered by decentralized peer-to-peer on-chain micro-settlements.`,
      `Empower your autonomous AI agents with self-custodial wallets, enabling them to discover, purchase, and pay for their own LLM compute in real time.`,
    ];
    const picked = answers[Math.floor(Math.random() * answers.length)];
    
    // Reveal text character by character for typing effect
    for (let i = 1; i <= picked.length; i++) {
      setAiResponse(picked.slice(0, i));
      await sleep(15);
    }
    
    addLog("Keyless x402 Handshake completed successfully!", "success");
    toast.success("Simulation finished successfully!");
  }

  return (
    <div className="flex h-full">
      {/* Center content */}
      <div className="flex-1 max-w-5xl px-8 py-10 lg:px-12 mx-auto min-h-screen pb-32">
        {/* Breadcrumbs */}
        <div className="text-[12px] text-slate-400 font-medium mb-3 flex items-center gap-1.5">
          <span>Sentinel Protocol</span>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-slate-600 font-semibold">x402 Sandbox</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">⚡ x402 Keyless Handshake Playground</h1>
          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full uppercase tracking-wider">Interactive Sandbox</span>
        </div>

        <div className="flex flex-col gap-8">
      {/* Introduction Header */}
      <div className="relative bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 md:p-8 hover-glow-card transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-100/20 to-transparent rounded-bl-full -z-10"></div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
            <span className="material-symbols-outlined text-xl">play_circle</span>
          </div>
          <div>
            <h2 className="font-headline text-2xl font-extrabold tracking-tight text-slate-900">x402 Handshake Sandbox</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Interactive Keyless Gateway Simulator</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
          Observe how Sentinel utilizes the **HTTP 402 Payment Required** standard to execute keyless API access. 
          When an unauthenticated request is received, the gateway returns on-chain invoicing details. The client's local 
          burner wallet dynamically signs a micro-transaction, broadcasts it, and retries the request with a transaction hash—all completed automatically in seconds.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Left Side: Mock Request Settings Editor */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 hover:shadow-lg transition-shadow">
            <h3 className="font-headline text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">settings</span>
              Configure Sandbox
            </h3>
            
            <div className="flex flex-col gap-4">
              {/* Endpoint Display */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Endpoint</label>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 truncate">
                  POST {mockEndpoint}
                </div>
              </div>

              {/* Mock Prompt */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Developer Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={stage !== "idle" && stage !== "completed"}
                  className="w-full min-h-[70px] bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-body resize-y disabled:opacity-60"
                  placeholder="Enter a prompt to submit..."
                />
              </div>

              {/* AI Provider & Model grid selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    disabled={stage !== "idle" && stage !== "completed"}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-0 disabled:opacity-60"
                  >
                    {Object.keys(providers).map((k) => (
                      <option key={k} value={k}>{providers[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Model Name</label>
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    disabled={stage !== "idle" && stage !== "completed"}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-0 disabled:opacity-60"
                  >
                    {providers[aiProvider].models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost config */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost per Call (ALGO)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="1.0"
                    value={priceAlgo}
                    onChange={(e) => setPriceAlgo(e.target.value)}
                    disabled={stage !== "idle" && stage !== "completed"}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Consensus Speed (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={latency}
                    onChange={(e) => setLatency(Number(e.target.value))}
                    disabled={stage !== "idle" && stage !== "completed"}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Execute Button */}
              <button
                type="button"
                onClick={runSimulation}
                disabled={stage !== "idle" && stage !== "completed"}
                className="w-full py-3 bg-[#031634] hover:bg-[#021026] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#031634]/10 hover:shadow-lg disabled:opacity-50 mt-2"
              >
                <span className="material-symbols-outlined text-sm">flash_on</span>
                {stage === "idle" || stage === "completed" ? "Trigger x402 Handshake" : "Executing Simulation..."}
              </button>
            </div>
          </div>

          {/* Quick Integration Help */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 hover:shadow-lg transition-shadow">
            <h3 className="font-headline text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">code</span>
              x402 Integration Code
            </h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Standard client wrapper integrates the handshake loop seamlessly in 3 lines:
            </p>
            <pre className="bg-slate-900 text-slate-200 p-3 rounded-lg text-[10px] font-mono leading-relaxed overflow-x-auto border border-slate-800">
{`import { x402Fetch } from "@x402/fetch";

const res = await x402Fetch("${apiBase}/api/x402/use/srv_mock123", {
  method: "POST",
  body: JSON.stringify({ prompt: "Hello!" })
});`}
            </pre>
          </div>
        </div>

        {/* Right Side: Handshake Node Connections Visualizer & Terminal Logs */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Handshake Visualizer Panel */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 hover:shadow-lg transition-shadow relative overflow-hidden">
            <h3 className="font-headline text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">hub</span>
              Node Network Loop
            </h3>

            {/* Dotted Connections Visualizer */}
            <div className="relative flex justify-between items-center py-6 max-w-md mx-auto z-10 mb-4">
              {/*Dotted SVG lines connecting nodes */}
              <svg className="absolute inset-0 w-full h-full -z-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                {/* Dotted client-server line */}
                <path
                  d="M 40 45 H 320"
                  stroke="#E2E8F0"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                
                {/* Dotted client-ledger line */}
                <path
                  d="M 40 45 L 180 120"
                  stroke="#E2E8F0"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />

                {/* Animated Pulsing Packets */}
                {(stage === "sending_initial" || stage === "verified_200") && (
                  <circle r="5" fill="#6366F1" className="animate-pulse">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path="M 40 45 H 320"
                    />
                  </circle>
                )}

                {stage === "challenge_402" && (
                  <circle r="5" fill="#F59E0B" className="animate-pulse">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path="M 320 45 H 40"
                    />
                  </circle>
                )}

                {stage === "signing_tx" && (
                  <circle r="4" fill="#3B82F6" className="animate-pulse">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path="M 40 45 L 180 120"
                    />
                  </circle>
                )}
                
                {stage === "ledger_sync" && (
                  <circle r="5" fill="#10B981" className="animate-pulse">
                    <animateMotion
                      dur="1.2s"
                      repeatCount="indefinite"
                      path="M 180 120 L 320 45"
                    />
                  </circle>
                )}
              </svg>

              {/* Node 1: Client Node */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 relative ${
                  stage === "sending_initial" || stage === "signing_tx"
                    ? "bg-indigo-50 border-indigo-500 ring-4 ring-indigo-500/10 text-indigo-600 scale-105"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                  <span className="material-symbols-outlined text-2xl">laptop_mac</span>
                  {stage === "signing_tx" && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 text-[8px] font-bold animate-ping">
                      KEY
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client App</span>
              </div>

              {/* Node 2: Sentinel Node */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-300 ${
                  stage === "challenge_402" || stage === "verified_200" || stage === "completed"
                    ? "bg-emerald-50 border-emerald-500 ring-4 ring-emerald-500/10 text-emerald-600 scale-105"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                  <span className="material-symbols-outlined text-2xl">dns</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sentinel Node</span>
              </div>
            </div>

            {/* Dotted Node 3: Ledger Node (centered below) */}
            <div className="flex flex-col items-center gap-1.5 z-10 relative mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 ${
                stage === "ledger_sync"
                  ? "bg-emerald-50 border-emerald-500 ring-4 ring-emerald-500/10 text-emerald-600 scale-105"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}>
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Algorand Ledger</span>
            </div>

            {/* Step-by-Step Interactive Status Panel */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-2 mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Handshake Progression</span>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  {stage === "idle" && "Idle"}
                  {stage === "sending_initial" && "Stage 1: Dispatch Request"}
                  {stage === "challenge_402" && "Stage 2: HTTP 402 challenge"}
                  {stage === "signing_tx" && "Stage 3: Sign Micro-Tx"}
                  {stage === "ledger_sync" && "Stage 4: Blockchain consensus"}
                  {stage === "verified_200" && "Stage 5: Retry request"}
                  {stage === "completed" && "Stage 6: Complete 200 OK"}
                </span>
              </div>

              <div className="text-xs leading-relaxed text-slate-600 font-medium">
                {stage === "idle" && "Configure parameters on the left and trigger simulation to observe the network handshake."}
                {stage === "sending_initial" && "Client sends prompt without any API keys or payment hashes to the protected API Gateway."}
                {stage === "challenge_402" && "Server detects zero auth parameters. Returns HTTP 402 (Payment Required) carrying custom note reference and price tags."}
                {stage === "signing_tx" && "Local client agent parses 402 headers, initializes the integrated burner wallet, and signs an on-chain transaction matching requirements."}
                {stage === "ledger_sync" && `Client broadcasts transaction note to Algorand Testnet. Waiting ${latency}s for decentralized validation...`}
                {stage === "verified_200" && "Client resends original query, appending transaction ID into request header. Server checks blockchain state and validates payment."}
                {stage === "completed" && "Validation successful! Server executes AI inference query, returns HTTP 200 (OK), and delivers response."}
              </div>
            </div>
          </div>

          {/* Sandbox Live Console Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 font-mono">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Live Sandbox Console</span>
              </div>
              <button
                onClick={() => setSimulationLogs([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider border border-slate-800 hover:border-slate-700 px-2 py-0.5 rounded transition-colors"
              >
                Clear Console
              </button>
            </div>

            {/* Logs Area */}
            <div className="min-h-[220px] max-h-[300px] overflow-y-auto flex flex-col gap-2.5 text-xs custom-scrollbar">
              {simulationLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-12 italic">
                  {"Console idle. Click 'Trigger x402 Handshake' to display live debug logs..."}
                </div>
              ) : (
                simulationLogs.map((log, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 text-[10px] select-none mt-0.5">{log.time}</span>
                      
                      {log.type === "send" && <span className="text-indigo-400 font-bold">➔ [SEND]</span>}
                      {log.type === "receive" && <span className="text-amber-400 font-bold">L [RECV]</span>}
                      {log.type === "success" && <span className="text-emerald-400 font-bold">✓ [SUCC]</span>}
                      {log.type === "warn" && <span className="text-yellow-400 font-bold">⚠ [WARN]</span>}
                      {log.type === "info" && <span className="text-slate-400 font-bold">i [INFO]</span>}
                      {log.type === "header" && <span className="text-pink-400 font-bold">❖ [HTTP]</span>}

                      <span className={`flex-1 ${
                        log.type === "header" ? "text-pink-400 font-bold" :
                        log.type === "success" ? "text-emerald-300" :
                        log.type === "warn" ? "text-yellow-200" : "text-slate-300"
                      }`}>{log.message}</span>
                    </div>

                    {/* Nested JSON Headers Display */}
                    {log.details && (
                      <pre className="bg-slate-950/60 text-slate-400 p-2.5 rounded border border-slate-800/40 text-[10px] ml-16 overflow-x-auto">
                        {typeof log.details === "object" ? JSON.stringify(log.details, null, 2) : log.details}
                      </pre>
                    )}
                  </div>
                ))
              )}

              {/* Streaming Output Display */}
              <AnimatePresence>
                {aiResponse && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-t border-slate-800/50 pt-3 mt-1 flex flex-col gap-1.5"
                  >
                    <div className="flex gap-2 items-center text-emerald-400 text-xs">
                      <span className="material-symbols-outlined text-sm animate-pulse">check_circle</span>
                      <span className="font-bold">Final AI Generation Output:</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60 text-xs text-slate-200 leading-relaxed font-body">
                      {aiResponse}
                      {stage !== "completed" && <span className="inline-block w-1.5 h-3.5 bg-emerald-400 ml-1 animate-pulse" />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
