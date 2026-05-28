import React, { useEffect, useState, useMemo } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getBurnerWallet, getBurnerAddress } from "../wallet/burner.js";
import algosdk from "algosdk";
import toast from "react-hot-toast";

const DEFAULT_MNEMONIC = "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown";

export default function X402Docs() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("playground"); // "playground" | "docs"
  const [docLanguage, setDocLanguage] = useState("curl"); // "curl" | "js" | "python"

  // Playground state
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [prompt, setPrompt] = useState("Explain the concept of anti-gravity in one simple sentence.");
  const [walletMode, setWalletMode] = useState("profile"); // "profile" | "demo"
  const [demoMnemonic, setDemoMnemonic] = useState(DEFAULT_MNEMONIC);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletAddress, setWalletAddress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [aiOutput, setAiOutput] = useState("");
  const [rawJson, setRawJson] = useState(null);

  // Network client
  const algodUrl = "https://testnet-api.algonode.cloud";
  const algodClient = useMemo(() => new algosdk.Algodv2("", algodUrl, ""), []);

  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Load services and wallet info
  useEffect(() => {
    fetchServices();
  }, []);

  // Update wallet details on mode/mnemonic changes
  useEffect(() => {
    resolveActiveWallet();
  }, [walletMode, demoMnemonic, user]);

  const fetchServices = async () => {
    try {
      const res = await api.get("/api/x402/services");
      const list = res.data.services || [];
      setServices(list);
      if (list.length > 0) {
        setSelectedServiceId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load x402 services:", err);
      toast.error("Could not load x402 services from backend");
    }
  };

  const resolveActiveWallet = async () => {
    try {
      let addr = "";
      if (walletMode === "profile" && user?.walletAddress) {
        try {
          const burner = getBurnerWallet(user._id);
          addr = burner.addr;
        } catch {
          // Fallback to primary if burner not initialized
          addr = user.walletAddress;
        }
      } else if (walletMode === "demo" && demoMnemonic.trim()) {
        try {
          const key = algosdk.mnemonicToSecretKey(demoMnemonic.trim());
          addr = key.addr;
        } catch {
          addr = "";
        }
      }

      setWalletAddress(addr);
      if (addr) {
        const info = await algodClient.accountInformation(addr).do();
        setWalletBalance(Number(info.amount) / 1_000_000);
      } else {
        setWalletBalance(0);
      }
    } catch (err) {
      console.warn("Wallet resolution error:", err.message);
      setWalletBalance(0);
    }
  };

  const addLog = (message, type = "info") => {
    const time = new Date().toTimeString().split(" ")[0];
    setConsoleLogs(prev => [...prev, { time, message, type }]);
  };

  const executeX402Flow = async () => {
    if (!walletAddress) {
      toast.error("Invalid wallet configured");
      return;
    }
    if (!selectedServiceId) {
      toast.error("Please select a service first");
      return;
    }

    setIsRunning(true);
    setConsoleLogs([]);
    setAiOutput("");
    setRawJson(null);

    addLog(`Initiating x402 lifecycle for "${selectedService?.name || 'Selected Service'}"...`);

    try {
      // 1. Resolve Account Key
      let accountSk;
      if (walletMode === "profile") {
        const burner = getBurnerWallet(user._id);
        accountSk = burner.sk;
      } else {
        const key = algosdk.mnemonicToSecretKey(demoMnemonic.trim());
        accountSk = key.sk;
      }

      // 2. Fetch challenge (Round 1)
      addLog("Round 1: Fetching payment challenge from endpoint...");
      let challenge = null;
      try {
        await api.post(`/api/x402/use/${selectedServiceId}`, {
          messages: [{ role: "user", content: prompt }]
        });
      } catch (err) {
        if (err.response && err.response.status === 402) {
          challenge = err.response.data;
          addLog("Challenge intercepted successfully! Status 402.", "success");
        } else {
          throw new Error(`Expected HTTP 402 challenge, received: ${err.message}`);
        }
      }

      if (!challenge || !challenge.accepts || challenge.accepts.length === 0) {
        throw new Error("Invalid challenge layout received from server.");
      }

      const paymentRule = challenge.accepts[0];
      const receiver = paymentRule.payTo;
      const amountMicro = Number(paymentRule.maxAmountRequired);

      addLog(`Challenge instructions: Send ${amountMicro / 1_000_000} ALGO to creator: ${receiver}`);

      // 3. Create on-chain transaction
      addLog("Signing transaction using burner private key...");
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: walletAddress,
        sender: walletAddress,
        to: receiver,
        receiver: receiver,
        amount: BigInt(amountMicro),
        suggestedParams: params,
        note: new TextEncoder().encode("SentinelAI browser-integrated x402 test")
      });

      const signedTxnBytes = txn.signTxn(accountSk);
      const txId = txn.txID();
      addLog(`Transaction signed. ID: ${txId}`, "success");

      // 4. Submit to blockchain
      addLog("Broadcasting transaction to Algorand TestNet...");
      await algodClient.sendRawTransaction(signedTxnBytes).do();
      addLog("Transaction broadcasted successfully. Waiting for block confirmation...", "warning");

      let confirmed = false;
      let attempts = 0;
      while (!confirmed && attempts < 10) {
        try {
          const info = await algodClient.pendingTransactionInformation(txId).do();
          if (info["confirmed-round"]) {
            confirmed = true;
            addLog(`Transaction confirmed in block round: ${info["confirmed-round"]}!`, "success");
            break;
          }
        } catch {}
        attempts++;
        await new Promise(r => setTimeout(r, 1500));
      }

      if (!confirmed) {
        throw new Error(`Transaction ${txId} did not confirm within timeout limit.`);
      }

      // 5. Build X-Payment Base64 Header
      addLog("Packaging signed transaction into X-Payment base64 header...");
      const binString = Array.from(signedTxnBytes, (byte) => String.fromCharCode(byte)).join("");
      const base64Tx = window.btoa(binString);
      const payload = {
        paymentGroup: [base64Tx],
        paymentIndex: 0
      };
      const xPaymentHeader = window.btoa(JSON.stringify(payload));

      // 6. Submit request with X-Payment header (Round 2)
      addLog("Round 2: Submitting request with on-chain payment proof...");
      const res = await api.post(`/api/x402/use/${selectedServiceId}`, 
        { messages: [{ role: "user", content: prompt }] },
        { headers: { "X-Payment": xPaymentHeader } }
      );

      addLog("Payment verified! HTTP 200 Received.", "success");
      setAiOutput(res.data.choices[0].message.content);
      setRawJson(res.data);

    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
      addLog(`Execution Failed: ${errMsg}`, "error");
    } finally {
      setIsRunning(false);
      resolveActiveWallet(); // Refresh balance
    }
  };

  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard!");
  };

  // Code templates
  const codeTemplates = {
    curl: `# Step 1: Send request to trigger HTTP 402 challenge
curl -i -X POST http://localhost:5000/api/x402/use/${selectedServiceId || "<service-id>"} \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'

# The server returns:
# HTTP/1.1 402 Payment Required
# Payment-Required: <base64-encoded instructions>
# Body contains: { "x402Version": 2, "accepts": [{ "payTo": "CREATOR_WALLET...", "maxAmountRequired": "10000" }] }

# Step 2: Sign and submit Algorand transaction, then encode bytes:
# payload = { "paymentGroup": ["<base64-signed-tx>"], "paymentIndex": 0 }
# header_val = base64_encode(json(payload))

# Step 3: Resend request with X-Payment header
curl -i -X POST http://localhost:5000/api/x402/use/${selectedServiceId || "<service-id>"} \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: <header_val>" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`,

    js: `import { wrapFetchWithPayment } from "@x402/fetch";
import { toClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

// 1. Recover burner wallet key
const mnemonic = "<your-burner-wallet-mnemonic>";
const account = algosdk.mnemonicToSecretKey(mnemonic);

// 2. Wrap standard fetch with the x402 AVM adapter
const signer = toClientAvmSigner(account.sk);
const fetchWithPay = wrapFetchWithPayment(fetch, signer, {
  algod: {
    server: "https://testnet-api.algonode.cloud",
    token: ""
  }
});

// 3. Request the service endpoint — payment is handled automatically!
const res = await fetchWithPay("http://localhost:5000/api/x402/use/${selectedServiceId || "<service-id>"}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "${prompt}" }]
  })
});

const data = await res.json();
console.log(data.choices[0].message.content);`,

    python: `import base64
import json
import requests
from algosdk import account, transaction
from algosdk.v2client import algod

# Initialize algod client
algod_client = algod.AlgodClient("", "https://testnet-api.algonode.cloud", "")
private_key = account.mnemonic_to_private_key("<your-burner-wallet-mnemonic>")
sender_address = account.address_from_private_key(private_key)

url = "http://localhost:5000/api/x402/use/${selectedServiceId || '<service-id>'}"
body = {"messages": [{"role": "user", "content": "${prompt}"}]}

# Round 1: Trigger challenge
res1 = requests.post(url, json=body)
if res1.status_code == 402:
    challenge = res1.json()
    rule = challenge["accepts"][0]
    
    # Construct payment transaction
    params = algod_client.suggested_params()
    txn = transaction.PaymentTxn(
        sender=sender_address,
        receiver=rule["payTo"],
        amt=int(rule["maxAmountRequired"]),
        sp=params,
        note="x402 python payment"
    )
    
    # Sign and broadcast transaction
    signed_txn = txn.sign(private_key)
    tx_id = algod_client.send_transaction(signed_txn)
    
    # Wait for block confirmation
    transaction.wait_for_confirmation(algod_client, tx_id, 4)
    
    # Build X-Payment Base64 Header
    # ExactAvmPayload payload structure:
    tx_bytes = base64.b64encode(base64.b64decode(signed_txn.get_txid())).decode("utf-8")
    # Wrap bytes inside payload
    payload = {
        "paymentGroup": [base64.b64encode(transaction.write_to_file([signed_txn], None)).decode("utf-8")],
        "paymentIndex": 0
    }
    x_payment = base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
    
    # Round 2: Resend with proof
    res2 = requests.post(url, json=body, headers={"X-Payment": x_payment})
    print(res2.json()["choices"][0]["message"]["content"])`
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary">x402 Agentic AI Infrastructure</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Machine-payable API system enabling AI Agents to unlock pay-per-use services autonomously.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mt-4 md:mt-0 max-w-md self-start md:self-auto">
          <button
            onClick={() => setActiveTab("playground")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "playground" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Playground
          </button>
          <button
            onClick={() => setActiveTab("agent-guide")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "agent-guide" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Agentic AI Guide
          </button>
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "docs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Developer API
          </button>
        </div>
      </div>

      {activeTab === "playground" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left panel: Config */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-surface-variant rounded-md p-6">
              <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">wallet</span>
                Wallet Config
              </h2>

              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="walletMode"
                    value="profile"
                    checked={walletMode === "profile"}
                    onChange={(e) => setWalletMode(e.target.value)}
                    className="text-primary focus:ring-primary"
                  />
                  Use My Burner Wallet (Synced)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="walletMode"
                    value="demo"
                    checked={walletMode === "demo"}
                    onChange={(e) => setWalletMode(e.target.value)}
                    className="text-primary focus:ring-primary"
                  />
                  Use Custom Mnemonic (Demo Faucet)
                </label>
              </div>

              {walletMode === "demo" && (
                <div className="mb-4">
                  <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Mnemonic Phrase</label>
                  <textarea
                    value={demoMnemonic}
                    onChange={(e) => setDemoMnemonic(e.target.value)}
                    className="w-full border border-outline-variant rounded p-2 text-xs font-mono bg-slate-50 min-h-[60px]"
                    placeholder="Enter 25-word mnemonic phrase..."
                  />
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 rounded p-4 flex justify-between items-center text-xs">
                <div>
                  <p className="font-mono text-slate-800 font-semibold truncate max-w-xs md:max-w-md" title={walletAddress}>
                    Address: {walletAddress ? `${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 10)}` : "None"}
                  </p>
                  <p className="text-slate-500 mt-1">Balance: {walletBalance.toFixed(6)} ALGO</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  walletBalance >= 0.02 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {walletBalance >= 0.02 ? "Funded" : "Low Funds"}
                </span>
              </div>
            </div>

            <div className="bg-white border border-surface-variant rounded-md p-6">
              <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">smart_toy</span>
                AI Agent Request Details
              </h2>

              <div className="form-group mb-4">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Select Service</label>
                {services.length === 0 ? (
                  <select disabled className="w-full border border-outline-variant rounded p-2 bg-slate-50 text-xs">
                    <option>No services active on x402</option>
                  </select>
                ) : (
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full border border-outline-variant rounded p-2 text-xs bg-white"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.pricing.fixed_charge_algo} ALGO / call)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group mb-6">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Prompt Text</label>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full border border-outline-variant rounded p-2 text-xs bg-white"
                />
              </div>

              <button
                onClick={executeX402Flow}
                disabled={isRunning || !walletAddress || walletBalance < 0.015}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded text-xs transition-colors flex items-center justify-center gap-2 shadow"
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Executing Cycle...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Run x402 Payment Cycle
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right panel: Console logs */}
          <div className="space-y-6">
            <div className="bg-slate-950 border border-slate-900 rounded-md p-4 flex flex-col h-[280px] text-white">
              <p className="text-xs text-slate-400 font-semibold border-b border-slate-900 pb-2 mb-2 flex items-center gap-1.5 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                EXECUTION_CONSOLE
              </p>
              <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed pr-1 select-text">
                {consoleLogs.length === 0 ? (
                  <p className="text-slate-600 italic">Console idle. Configure wallet and click execute.</p>
                ) : (
                  consoleLogs.map((l, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-slate-600 select-none">[{l.time}]</span>
                      <span className={
                        l.type === "success" ? "text-emerald-400" :
                        l.type === "warning" ? "text-amber-400" :
                        l.type === "error" ? "text-rose-400" : "text-slate-300"
                      }>
                        {l.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-surface-variant rounded-md p-6 min-h-[190px] flex flex-col">
              <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-md">chat_bubble</span>
                Response Output
              </h3>
              <div className="flex-1 text-xs leading-relaxed text-slate-700 bg-slate-50 border border-slate-100 rounded p-3 select-text max-h-[220px] overflow-y-auto">
                {aiOutput ? aiOutput : <p className="italic text-slate-400">Response completion will appear here...</p>}
              </div>
            </div>
          </div>

          {/* Full-width JSON metadata */}
          {rawJson && (
            <div className="md:col-span-3 bg-white border border-surface-variant rounded-md p-6">
              <h3 className="font-semibold text-sm text-primary mb-3">On-Chain Transaction & Token Metadata</h3>
              <pre className="text-[10px] bg-slate-950 text-emerald-400 p-4 rounded overflow-x-auto select-all max-h-[300px]">
                {JSON.stringify(rawJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "agent-guide" && (
        <div className="space-y-6 text-slate-800">
          {/* Header Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-8 border border-indigo-500/20 shadow-lg animate-fadeIn">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
            
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 space-y-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mr-1.5 animate-pulse"></span>
                  Keyless Machine-to-Machine Payments
                </span>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">AI Agents as First-Class Economic Citizens</h2>
                <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Traditionally, autonomous software agents (LLMs, Langchain instances, or n8n workflow tools) had no way to pay for individual API calls. x402 enables agents to hold their own micro-budgets using secure browser burner wallets, parse standard HTTP 402 challenge-responses, sign payments, and verify on-chain automatically.
                </p>
              </div>
              <div className="shrink-0 flex items-center justify-center w-24 h-24 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                <span className="material-symbols-outlined text-5xl text-indigo-400 animate-pulse">support_agent</span>
              </div>
            </div>
          </div>

          {/* Handshake flow blocks */}
          <div>
            <h3 className="font-headline text-lg font-semibold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">sync_alt</span>
              The x402 Challenge-Response Handshake
            </h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm space-y-3 hover:border-slate-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold font-headline text-base">1</div>
                <h4 className="font-semibold text-slate-900 text-sm">HTTP 402 Challenge</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The agent calls the gated endpoint without payment. The server intercepts the request and responds with <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-semibold font-mono">402 Payment Required</code> containing the creator's wallet address and fixed ALGO cost.
                </p>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm space-y-3 hover:border-slate-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold font-headline text-base">2</div>
                <h4 className="font-semibold text-slate-900 text-sm">Automated Signing</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The agent library uses its local burner private key (or synced account) to sign a payment transaction, broadcasting it immediately to the Algorand TestNet blockchain.
                </p>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm space-y-3 hover:border-slate-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold font-headline text-base">3</div>
                <h4 className="font-semibold text-slate-900 text-sm">Verification & 200 OK</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Once confirmed (~3s), the agent packages the transaction into the <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-semibold font-mono">X-Payment</code> header and retries. Server verifies on-chain and returns the AI completion.
                </p>
              </div>
            </div>
          </div>

          {/* Creator & Developer cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm space-y-4">
              <h3 className="font-headline text-sm font-semibold text-primary flex items-center gap-2 border-b border-slate-50 pb-2">
                <span className="material-symbols-outlined text-base">toll</span>
                How to Apply: Creator Monetization
              </h3>
              <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                  <span><strong>Opt-In Services:</strong> Navigate to your Creator dashboard, select any API service you created, and toggle <strong>Enable x402 Access</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                  <span><strong>Declare Minimum Pricing:</strong> The system automatically uses the service's minimum charge rate as the fixed per-call fee.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
                  <span><strong>On-Chain Revenue:</strong> Payments are verified directly on the Algorand blockchain and land directly in your wallet without middleman delays or payout requests.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-100 rounded-lg p-6 shadow-sm space-y-4">
              <h3 className="font-headline text-sm font-semibold text-primary flex items-center gap-2 border-b border-slate-50 pb-2">
                <span className="material-symbols-outlined text-base">security</span>
                Trust, Sandboxing & Security
              </h3>
              <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-base">shield</span>
                  <span><strong>Replay Prevention:</strong> The backend verifies transaction hash uniqueness. Once a transaction is validated, the same ID can never be used again.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-base">shield</span>
                  <span><strong>Absolute Isolation:</strong> Agent burner wallets are isolated. They are loaded only with small amounts of utility tokens, protecting primary funds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-indigo-500 text-base">shield</span>
                  <span><strong>Decentralized Indexing:</strong> Real-time ledger lookup ensures trustless authentication. Sentinel checks the Algorand indexer node directly.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "docs" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Docs selection panel */}
          <div className="bg-white border border-surface-variant rounded-md p-6 h-fit">
            <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">code</span>
              Integration Code
            </h2>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setDocLanguage("curl")}
                className={`text-left px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  docLanguage === "curl" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                shell / curl
              </button>
              <button
                onClick={() => setDocLanguage("js")}
                className={`text-left px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  docLanguage === "js" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                Node.js (Javascript/TS)
              </button>
              <button
                onClick={() => setDocLanguage("python")}
                className={`text-left px-4 py-2 text-xs font-semibold rounded transition-colors ${
                  docLanguage === "python" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                Python (requests)
              </button>
            </div>

            <hr className="border-slate-100 my-4" />

            <h3 className="font-semibold text-slate-900 text-xs mb-2">Endpoint Details</h3>
            <div className="text-[11px] space-y-2 text-slate-500">
              <p>
                <span className="font-semibold font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">POST</span>
                <span className="font-mono ml-1 text-slate-800">/api/x402/use/:id</span>
              </p>
              <p>Keyless access (authentication happens via signed Algorand transaction confirmation).</p>
            </div>
          </div>

          {/* Docs code view */}
          <div className="md:col-span-2 bg-white border border-surface-variant rounded-md p-6 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-slate-900 text-sm">
                Example Implementation: <span className="uppercase text-xs font-bold text-primary">{docLanguage}</span>
              </h2>
              <button
                onClick={() => handleCopyCode(codeTemplates[docLanguage])}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                Copy Code
              </button>
            </div>

            <pre className="flex-1 bg-slate-950 text-slate-100 p-4 rounded overflow-x-auto select-text font-mono text-[11px] leading-relaxed border border-slate-900 min-h-[350px]">
              {codeTemplates[docLanguage]}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
