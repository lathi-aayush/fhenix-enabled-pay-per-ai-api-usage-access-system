# SentinelAI — Fhenix/CoFHE Edition

> Pay-per-AI-API-call marketplace with **privacy-preserving on-chain payments** using Fully Homomorphic Encryption (FHE), deployed on **Base Sepolia**.

[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)](https://sepolia.basescan.org)
[![FHE](https://img.shields.io/badge/Privacy-Fhenix%20FHE-purple)](https://fhenix.io)

---

## What is this?

SentinelAI lets creators monetize AI models on a pay-per-call basis. Users pay per API call using native ETH on Base Sepolia. Balances stored in the on-chain `SentinelPayment` contract are **FHE-encrypted** — nobody (not even the operator) can see individual user balances on-chain.

### How it works

SentinelAI lets creators monetize AI models on a pay-per-call basis. Users pay per API call using native ETH on Base Sepolia. Balances stored in the on-chain `SentinelPayment` contract are **FHE-encrypted** — nobody (not even the operator) can see individual user balances on-chain.

---

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + MetaMask
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Blockchain**: Base Sepolia (EVM, chainId 84532)
- **FHE**: Fhenix CoFHE — `@fhenixprotocol/cofhe-contracts` (`FHE.sol`, `euint64`)
- **SDK**: `@cofhe/sdk` (client-side encryption + permits) + `ethers.js` v6
- **Contract toolchain**: Hardhat + `@cofhe/hardhat-plugin`
- **Payment protocol**: x402 (HTTP 402 "Payment Required") — Fhenix EVM variant

---

## Repository Structure

```
fhenix-enabled-pay-per-ai-api-usage-access-system/
├── contract/                  Hardhat project (SentinelPayment.sol)
│   ├── contracts/
│   │   └── SentinelPayment.sol   FHE encrypted balance + per-call deductions
│   ├── scripts/deploy.js
│   └── contract_info.json        Written by deploy script
├── backend/                   Express API server
│   └── src/
│       ├── services/evmService.js          Base Sepolia RPC utils
│       ├── services/fhenixX402Middleware.js x402 payment verification
│       ├── routes/payment.js               Marketplace 2-step ETH payment
│       ├── routes/x402.js                  Keyless x402 AI calls
│       └── routes/auth.js                  MetaMask challenge auth
├── frontend/                  React SPA
│   └── src/
│       ├── wallet/metamask.js              MetaMask integration
│       ├── wallet/sessionKey.js            Local EVM key for headless payments
│       ├── context/MetaMaskLoginContext.jsx Login/registration
│       └── utils/explorer.js               BaseScan URL helpers
├── cofhesdk/                  Reference: @cofhe/sdk source
└── fhenix-confidential-contracts/ Reference: Fhenix confidential contracts
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- MongoDB
- MetaMask browser extension
- Base Sepolia ETH (from https://faucet.base.org)

### 1. Deploy the contract

```bash
cd contract
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY and RPC_URL

npm install
npm run deploy
# → writes contract_info.json with the deployed address
```

### 2. Start the backend

```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, CONTRACT_ADDRESS (from step 1),
# TREASURY_WALLET_ADDRESS, ENCRYPTION_KEY, ETH_USD_RATE

npm install
npm run dev     # http://localhost:5001
```

### 3. Start the frontend

```bash
cd frontend
cp .env.example .env
# Optional: set VITE_RPC_URL, VITE_CONTRACT_ADDRESS

npm install
npm run dev     # http://localhost:5173
```

Connect MetaMask to Base Sepolia (chainId 84532, RPC: `https://sepolia.base.org`) and get testnet ETH.

---

## Payment Flow

### Marketplace (2-step, MetaMask)

1. User browses marketplace, finds an AI service
2. Clicks "Purchase" → UI calls `POST /api/payment/create` → gets `{ receiver, amountWei }`
3. MetaMask pops up → user confirms ETH transfer to creator wallet
4. UI calls `POST /api/payment/verify` with `txHash` → backend confirms on-chain → issues `sk-sentinel-*` API key
5. User can now call the AI service with their API key

### x402 Keyless (auto-pay, session key)

1. UI calls `POST /api/use` (no payment header) → backend returns **HTTP 402** with `{ payTo, amountWei }`
2. Session key wallet auto-sends ETH to `payTo` (no MetaMask popup)
3. UI retries with `X-Payment: base64({ txHash, network, amount, payTo })`
4. Backend calls `verifyX402Payment()` → checks receipt on Base Sepolia
5. AI response returned with `sentinelReceipt.explorerUrl` → https://sepolia.basescan.org/tx/{txHash}

### FHE Contract Top-up

1. User deposits ETH to `SentinelPayment.deposit()` — stored as `euint64` encrypted balance
2. Backend deducts per-call amounts via `deductForCall()` using `@cofhe/sdk`-encrypted amounts
3. User reads sealed balance via `sealedBalance()` + `cofhejs.unseal()`

---

## License

MIT
