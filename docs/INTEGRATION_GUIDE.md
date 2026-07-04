# SentinelAI Integration Guide (Base Sepolia)

## Prerequisites

- MetaMask on Base Sepolia (chain ID `84532`)
- Testnet ETH from https://faucet.base.org
- Backend running at `http://localhost:5001`

## 1. Auth (MetaMask)

```javascript
// POST /api/auth/challenge → { nonce, message }
const signature = await window.ethereum.request({
  method: "personal_sign",
  params: [message, address],
});
// POST /api/auth/login → { token }
```

## 2. Marketplace API key (2-step ETH payment)

1. `POST /api/payment/create` with `serviceId` → `{ receiver, amountWei }`
2. Send ETH via MetaMask to `receiver`
3. `POST /api/payment/verify` with `{ txHash }` → API key

## 3. x402 keyless calls (session key)

Use the session key wallet for headless per-call ETH payments:

```javascript
import { callProxyX402Use } from "./api/proxyX402Use.js";

const { aiResponse, txHash, explorerUrl } = await callProxyX402Use({
  apiKey: "sk-sentinel-...",
  serviceId: "...",
  body: { messages: [{ role: "user", content: "Hello" }] },
});
```

Flow: `POST /api/use` → HTTP 402 → session key sends ETH → retry with `X-Payment` header (base64 JSON with `txHash`, `network`, `amount`, `payTo`).

## 4. Browser integration (MetaMask)

```javascript
import { connectMetaMask, sendEthPayment } from "./wallet/metamask.js";

const address = await connectMetaMask();
const { txHash } = await sendEthPayment({ from: address, to, amountWei });
```

## 5. FHE contract top-up

Deposit ETH to `SentinelPayment.deposit()`. Balances are FHE-encrypted (`euint64`). Unseal client-side with `@cofhe/sdk`.

See `AGENTS.md` for full architecture.
