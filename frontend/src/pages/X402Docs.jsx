export default function X402Docs() {
  return (
    <div className="prose prose-slate max-w-3xl mx-auto p-6">
      <h1>x402 Payments</h1>
      <p>
        SentinelAI uses HTTP 402 for pay-per-call AI access on Sepolia. The client requests an
        API call, receives payment requirements, sends ETH, then retries with an <code>X-Payment</code>{" "}
        header.
      </p>
      <ol>
        <li>POST <code>/api/use</code> without payment → 402 + <code>payTo</code> + <code>amountWei</code></li>
        <li>Send ETH on Sepolia (MetaMask or session key)</li>
        <li>Retry with <code>X-Payment</code> header (base64 JSON with tx hash)</li>
      </ol>
      <p>
        If you have an FHE prepaid balance, <code>/api/use</code> deducts encrypted wei first and
        skips x402 when balance is available.
      </p>
    </div>
  );
}
