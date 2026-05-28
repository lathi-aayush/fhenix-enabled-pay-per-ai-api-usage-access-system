import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const BASE_URL = "http://localhost:5001";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/x402/services",
    label: "List x402 Services",
    description: "Returns all services that have x402 payments enabled. No authentication required.",
    response: `{
  "services": [
    {
      "id": "64f3a...",
      "name": "Sentinal AI Official Chat",
      "description": "General-purpose AI assistant endpoint.",
      "costPerCall": 0.001,
      "creatorWallet": "ALGO_WALLET_ADDRESS...",
      "aiProvider": "openai",
      "model": "gpt-4o-mini"
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/x402/use/:serviceId",
    label: "Call x402-Gated Service",
    description:
      "Two-round x402 payment handshake. First call returns HTTP 402 with payment instructions. Second call (with X-Payment header) returns AI completion.",
    body: `{
  "messages": [
    { "role": "user", "content": "Your prompt here" }
  ]
}`,
    headers: `X-Payment: <base64-encoded signed Algorand tx>`,
    response: `// Round 1 — No X-Payment header:
// HTTP 402 Payment Required
{
  "x402Version": 2,
  "accepts": [
    {
      "payTo": "CREATOR_WALLET_ADDRESS",
      "maxAmountRequired": "1000",
      "network": "algorand-testnet",
      "asset": "ALGO"
    }
  ]
}

// Round 2 — With X-Payment header:
// HTTP 200 OK
{
  "id": "chatcmpl-...",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Anti-gravity is a hypothetical force..."
      }
    }
  ],
  "x402": {
    "paid": true,
    "txId": "ON_CHAIN_TX_ID",
    "amountPaid": 0.001
  }
}`,
  },
];

const codeTemplates = {
  curl: `# ── Step 1: Trigger HTTP 402 challenge ───────────────────
curl -i -X POST ${BASE_URL}/api/x402/use/<service-id> \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'

# Server responds:
# HTTP/1.1 402 Payment Required
# Body: { "x402Version": 2, "accepts": [{ "payTo": "WALLET...", "maxAmountRequired": "1000" }] }


# ── Step 2: Build the X-Payment header ───────────────────
# After signing and broadcasting the Algorand tx:
PAYLOAD='{"paymentGroup":["<base64-signed-tx>"],"paymentIndex":0}'
X_PAYMENT=$(echo -n "$PAYLOAD" | base64)


# ── Step 3: Retry with payment proof ─────────────────────
curl -i -X POST ${BASE_URL}/api/x402/use/<service-id> \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: $X_PAYMENT" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`,

  js: `import algosdk from "algosdk";
import axios from "axios";

const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
const mnemonic   = "<your-25-word-mnemonic>";
const account    = algosdk.mnemonicToSecretKey(mnemonic);
const serviceId  = "<service-id>";
const url        = "${BASE_URL}/api/x402/use/" + serviceId;
const body       = { messages: [{ role: "user", content: "Hello!" }] };

// ── Round 1: Trigger 402 challenge ───────────────────────
let challenge;
try {
  await axios.post(url, body);
} catch (err) {
  if (err.response?.status === 402) {
    challenge = err.response.data;
  } else throw err;
}

const rule       = challenge.accepts[0];
const amountMicro = BigInt(rule.maxAmountRequired);

// ── Sign & broadcast Algorand transaction ────────────────
const params   = await algodClient.getTransactionParams().do();
const txn      = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  sender: account.addr,
  receiver: rule.payTo,
  amount: amountMicro,
  suggestedParams: params,
  note: new TextEncoder().encode("x402 payment"),
});
const signedBytes = txn.signTxn(account.sk);
const txId        = txn.txID();
await algodClient.sendRawTransaction(signedBytes).do();

// Wait for confirmation (~3-5 seconds on TestNet)
let confirmed = false;
while (!confirmed) {
  const info = await algodClient.pendingTransactionInformation(txId).do();
  if (info["confirmed-round"]) confirmed = true;
  else await new Promise(r => setTimeout(r, 1500));
}

// ── Build X-Payment header ───────────────────────────────
const binStr  = Array.from(signedBytes, b => String.fromCharCode(b)).join("");
const b64tx   = btoa(binStr);
const payload = { paymentGroup: [b64tx], paymentIndex: 0 };
const xPayment = btoa(JSON.stringify(payload));

// ── Round 2: Submit with payment proof ───────────────────
const res  = await axios.post(url, body, {
  headers: { "X-Payment": xPayment },
});
console.log(res.data.choices[0].message.content);`,

  python: `import base64, json, time
import requests
from algosdk import account, mnemonic as sdk_mnemonic
from algosdk.v2client import algod
from algosdk import transaction

algod_client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")
private_key  = sdk_mnemonic.to_private_key("<your-25-word-mnemonic>")
sender       = account.address_from_private_key(private_key)
service_id   = "<service-id>"
url          = f"${BASE_URL}/api/x402/use/{service_id}"
body         = {"messages": [{"role": "user", "content": "Hello!"}]}

# ── Round 1: Trigger 402 challenge ───────────────────────
res1 = requests.post(url, json=body)
assert res1.status_code == 402, f"Expected 402, got {res1.status_code}"
rule = res1.json()["accepts"][0]
amount = int(rule["maxAmountRequired"])

# ── Sign & broadcast Algorand transaction ────────────────
params = algod_client.suggested_params()
txn    = transaction.PaymentTxn(
    sender=sender, receiver=rule["payTo"],
    amt=amount, sp=params, note=b"x402 payment"
)
signed = txn.sign(private_key)
tx_id  = algod_client.send_transaction(signed)
transaction.wait_for_confirmation(algod_client, tx_id, 4)

# ── Build X-Payment header ───────────────────────────────
signed_bytes = base64.b64encode(
    transaction.encoding.msgpack_encode(signed).encode("latin-1")
).decode()
payload  = {"paymentGroup": [signed_bytes], "paymentIndex": 0}
x_payment = base64.b64encode(json.dumps(payload).encode()).decode()

# ── Round 2: Submit with payment proof ───────────────────
res2 = requests.post(url, json=body, headers={"X-Payment": x_payment})
print(res2.json()["choices"][0]["message"]["content"])`,
};

const METHOD_COLOR = {
  GET: "bg-emerald-100 text-emerald-800",
  POST: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

export default function X402DevDocs() {
  const navigate = useNavigate();
  const [lang, setLang] = useState("js");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(codeTemplates[lang]);
    setCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={() => navigate("/docs/x402")}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[13px]">arrow_back</span>
            x402 Playground
          </button>
          <span className="text-slate-200">/</span>
          <span className="text-xs text-slate-500 font-medium">Developer API</span>
        </div>
        <h1 className="font-headline text-2xl font-semibold text-primary mt-2">
          x402 API Reference
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-2xl">
          Complete reference for integrating the x402 payment protocol into your agents, apps, and automation pipelines.
          Payment replaces authentication — no API keys required.
        </p>
      </div>

      {/* Flow explainer */}
      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500 text-base">sync_alt</span>
          The Two-Round Handshake
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { step: "1", color: "blue",    icon: "send",        title: "Call the endpoint",  desc: "Make a POST request with no special headers. You get HTTP 402 back." },
            { step: "2", color: "amber",   icon: "currency_bitcoin", title: "Pay on-chain",  desc: "Sign & broadcast an Algorand transaction to the creator's wallet." },
            { step: "3", color: "emerald", icon: "check_circle", title: "Receive response", desc: "Retry with the X-Payment header. Server verifies on-chain and returns AI output." },
          ].map(({ step, color, icon, title, desc }) => (
            <div key={step} className={`bg-${color}-50 border border-${color}-100 rounded-lg p-4 space-y-2`}>
              <div className={`w-8 h-8 rounded-lg bg-${color}-100 text-${color}-700 flex items-center justify-center font-bold text-sm font-headline`}>
                {step}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-${color}-600 text-base`}>{icon}</span>
                <span className="text-sm font-semibold text-slate-800">{title}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-primary text-base">api</span>
          Endpoints
        </h2>
        {API_ENDPOINTS.map((ep) => (
          <div key={ep.path} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${METHOD_COLOR[ep.method]}`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono text-slate-800">{ep.path}</code>
              </div>
              <p className="text-xs text-slate-500 mt-1">{ep.description}</p>
            </div>
            <div className={`grid gap-0 ${ep.body ? "md:grid-cols-2" : "grid-cols-1"}`}>
              {ep.body && (
                <div className="border-r border-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Request Body</p>
                  <pre className="bg-slate-950 text-slate-200 rounded p-3 text-[10px] font-mono overflow-x-auto">
                    {ep.body}
                  </pre>
                  {ep.headers && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-3">Headers (Round 2 only)</p>
                      <pre className="bg-slate-950 text-indigo-300 rounded p-3 text-[10px] font-mono overflow-x-auto">
                        {ep.headers}
                      </pre>
                    </>
                  )}
                </div>
              )}
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Response</p>
                <pre className="bg-slate-950 text-emerald-300 rounded p-3 text-[10px] font-mono overflow-x-auto leading-relaxed">
                  {ep.response}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Code Examples */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">terminal</span>
            Full Integration Example
          </h2>
          <div className="flex items-center gap-2">
            {/* Language tabs */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {[
                { key: "js",     label: "Node.js" },
                { key: "python", label: "Python"  },
                { key: "curl",   label: "cURL"    },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setLang(key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    lang === key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <pre className="bg-slate-950 text-slate-100 p-5 overflow-x-auto font-mono text-[11px] leading-relaxed min-h-[320px]">
          {codeTemplates[lang]}
        </pre>
      </div>

      {/* X-Payment Header format */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">security</span>
          X-Payment Header Format
        </h2>
        <p className="text-xs text-slate-500">The header value is a base64-encoded JSON payload:</p>
        <pre className="bg-slate-950 text-indigo-300 rounded p-4 font-mono text-[11px] leading-relaxed overflow-x-auto">
{`// 1. Encode your signed Algorand transaction bytes to base64:
const b64tx = btoa(String.fromCharCode(...signedTxnBytes));

// 2. Wrap in payload object:
const payload = {
  "paymentGroup": [b64tx],  // Array of signed transaction(s)
  "paymentIndex": 0          // Which tx in group is the payment
};

// 3. Base64-encode the JSON:
const X_PAYMENT = btoa(JSON.stringify(payload));

// 4. Attach as header:
// X-Payment: <X_PAYMENT value>`}
        </pre>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center gap-4 py-4">
        <button
          type="button"
          onClick={() => navigate("/docs/x402")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">science</span>
          Open Live Playground
        </button>
        <span className="text-xs text-slate-400">Test a real x402 payment with your burner wallet</span>
      </div>
    </div>
  );
}
