export default function X402DevDocs() {
  return (
    <div className="prose prose-slate max-w-3xl mx-auto p-6">
      <h1>x402 Developer Guide</h1>
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// 1. Challenge
const res = await fetch("https://your-api/api/use", {
  method: "POST",
  headers: { "X-API-Key": "sk-sentinel-..." },
  body: JSON.stringify({ prompt: "Hello" }),
});
// → 402 + { accepts: [{ payTo, maxAmountRequired, network }] }

// 2. Pay on-chain, then retry with header
const xPayment = btoa(JSON.stringify({
  txHash: "0x...",
  network: "eip155:11155111",
  amount: "100000000000000",
  payTo: "0xCreator...",
}));
await fetch("https://your-api/api/use", {
  method: "POST",
  headers: {
    "X-API-Key": "sk-sentinel-...",
    "X-Payment": xPayment,
  },
  body: JSON.stringify({ prompt: "Hello" }),
});`}
      </pre>
    </div>
  );
}
