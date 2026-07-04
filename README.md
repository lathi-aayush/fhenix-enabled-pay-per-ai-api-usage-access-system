# SentinelAI — Fhenix/CoFHE Edition

> Pay-per-AI-API-call marketplace with **privacy-preserving on-chain payments** using Fully Homomorphic Encryption (FHE), deployed on **Base Sepolia** or **Ethereum Sepolia**.

[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)](https://sepolia.basescan.org)
[![Sepolia](https://img.shields.io/badge/Network-Ethereum%20Sepolia-lightgrey)](https://sepolia.etherscan.io)
[![FHE](https://img.shields.io/badge/Privacy-Fhenix%20CoFHE-purple)](https://fhenix.io)
[![x402](https://img.shields.io/badge/Payments-x402-green)](https://github.com/coinbase/x402)

---

## Table of contents

- [What is this?](#what-is-this)
- [Key features](#key-features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Network configuration](#network-configuration)
- [Environment variables](#environment-variables)
- [Smart contract](#smart-contract)
- [Payment flows](#payment-flows)
- [Authentication](#authentication)
- [API overview](#api-overview)
- [Frontend](#frontend)
- [FHE & CoFHE](#fhe--cofhe)
- [Production deployment](#production-deployment)
- [Further documentation](#further-documentation)
- [License](#license)

---

## What is this?

**SentinelAI** is a full-stack platform where **creators** publish AI services (OpenAI-compatible chat, custom endpoints, workflows) and **consumers** pay per call in native ETH. The platform combines:

- A **marketplace** with MetaMask checkout and issued API keys (`sk-sentinel-*`)
- **x402** (HTTP 402) keyless per-call payments via a local session-key wallet
- **FHE-encrypted prepaid balances** in `SentinelPayment.sol` — on-chain balances are `euint64` ciphertexts; only the user with a CoFHE permit can unseal their balance
- **AI Studio** — blogging, prompt tools, viral thumbnails, creative workflows, ClipCraft video pipeline, agentic pipelines
- **Gateway v2** — Redis-backed prepaid API proxy (`POST /proxy/:slug`) alongside the legacy marketplace
- **Workflow Studio** — visual node-based AI workflow builder with execution history

Balances stored in the on-chain contract are **FHE-encrypted** — nobody (not even the operator) can read individual user balances without the user's permit.

---

## Key features

| Area | Description |
|------|-------------|
| **Marketplace** | Browse services, purchase access with MetaMask, call APIs with issued keys |
| **x402 auto-pay** | Session key wallet pays per call without MetaMask popups |
| **FHE wallet** | Deposit ETH → encrypted `euint64` balance; per-call `deductForCall()` stays encrypted |
| **Creator tools** | Service publishing, earnings dashboard, webhooks, reviews |
| **AI Studio** | Subscription tiers (free → enterprise), credit pools, ETH overage via x402 |
| **Gateway v2** | Developer API catalog, consumer deposits, Redis metering, payout requests |
| **Workflows** | Build, estimate, and run multi-step AI workflows with structured outputs |
| **Docs in-app** | `/docs/*` — x402, CLI, migration, pricing, withdrawal, FAQ |

---

## Architecture

```mermaid
flowchart TB
  subgraph client [Frontend — React + Vite]
    MM[MetaMask]
    SK[Session key wallet]
    COFHE["@cofhe/sdk"]
    UI[Marketplace / Studio / Gateway / Workflows]
  end

  subgraph server [Backend — Express + MongoDB]
    AUTH[/api/auth]
    USE[/api/use + x402]
    FHE[fheDeductionService]
    GW[/proxy/:slug + Redis]
    STUDIO[/api/studio]
  end

  subgraph chain [EVM — Sepolia or Base Sepolia]
    SP[SentinelPayment.sol]
  end

  UI --> AUTH
  UI --> USE
  MM --> SP
  SK --> USE
  COFHE --> SP
  USE --> FHE
  FHE --> SP
  USE --> AI[AI providers — OpenAI, Groq, Gemini, custom]
  GW --> AI
  STUDIO --> AI
```

**Payment priority on `/api/use`:** If the user has a prepaid FHE balance on `SentinelPayment`, the backend deducts via `deductForCall()` first (no x402). If no balance, the x402 ETH flow is used.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, Vite 6, TailwindCSS, React Router 7, TanStack Query, Zustand, Framer Motion, XYFlow |
| **Wallets** | MetaMask (`ethers` v6), session key (local encrypted EVM key), `wagmi` + `viem` |
| **Backend** | Node.js ≥ 20, Express 4, Mongoose 8, BullMQ + Redis (optional), Helmet, rate limiting |
| **Blockchain** | Base Sepolia (`84532`) or Ethereum Sepolia (`11155111`) |
| **FHE** | `@fhenixprotocol/cofhe-contracts` (`FHE.sol`, `euint64`), `@cofhe/sdk` |
| **Contract toolchain** | Hardhat 2 + `@cofhe/hardhat-plugin` |
| **Payments** | x402 (HTTP 402 challenge/verify), native ETH transfers |
| **AI** | OpenAI-compatible proxy, Groq, Google Gemini / Vertex (Studio features) |

---

## Repository structure

```
fhenix-enabled-pay-per-ai-api-usage-access-system/
├── contract/                         Hardhat — SentinelPayment.sol (FHE)
│   ├── contracts/SentinelPayment.sol   Encrypted balances + operator deductions
│   ├── scripts/deploy.js               Writes contract/contract_info.json
│   └── hardhat.config.ts             eth-sepolia + base-sepolia networks
│
├── backend/                          Express API (default port 5000)
│   └── src/
│       ├── server.js                   Route mounting, SPA serve in production
│       ├── loadEnv.js                  Env loading + dev operator key fallback
│       ├── config/
│       │   ├── chainConfig.js          Sepolia / Base Sepolia presets
│       │   └── contractConfig.js       CONTRACT_ADDRESS from env or JSON
│       ├── routes/
│       │   ├── auth.js                 MetaMask challenge/login
│       │   ├── services.js             Marketplace catalog CRUD
│       │   ├── payment.js              2-step ETH purchase + API key
│       │   ├── use.js                  Main AI proxy + x402 + FHE fallback
│       │   ├── x402.js                 Authenticated x402 per-service calls
│       │   ├── wallet.js               FHE contract top-up intents
│       │   ├── contract.js             On-chain stats
│       │   ├── creator.js              Creator dashboard, webhooks
│       │   ├── gateway.js              Gateway v2 prepaid proxy billing
│       │   ├── studio.routes.js        AI Studio features
│       │   ├── workflows.js            Workflow builder API
│       │   └── profile.js              Session keys, burner wallet
│       ├── services/
│       │   ├── evmService.js           RPC, receipts, address utils
│       │   ├── fhenixX402Middleware.js HTTP 402 build/verify
│       │   ├── fheDeductionService.js  CoFHE encrypt + deductForCall
│       │   ├── fhePaymentFlow.js       FHE-first AI payment path
│       │   └── billing.js              Charge computation, wei tolerance
│       └── studio/clipcraft/           Video pipeline (optional subsystem)
│
├── frontend/                         React SPA (dev: http://localhost:5173)
│   └── src/
│       ├── wallet/metamask.js          Connect, sign, send ETH
│       ├── wallet/sessionKey.js        Headless x402 payments
│       ├── wallet/cofheBalance.js      FHE deposit + unseal balance
│       ├── api/proxyX402Use.js         x402 AI call helper
│       ├── context/                    AuthContext, MetaMaskLoginContext
│       ├── pages/                      Marketplace, Studio, Gateway, Docs, Workflows
│       └── config/chain.js             Must match backend CHAIN_ID
│
├── docs/                             Written guides
│   ├── INTEGRATION_GUIDE.md          Auth, marketplace, x402, FHE top-up
│   ├── POST_DEPLOYMENT_GUIDE.md      Production checklist
│   ├── GATEWAY_V2.md                 Gateway prepaid billing
│   └── STUDIO_REVENUE_MODEL.md       Studio tiers + overage pricing
│
├── cofhesdk/                         Vendored CoFHE SDK monorepo (reference)
└── AGENTS.md                         Agent/developer quick reference
```

---

## Prerequisites

- **Node.js** ≥ 20 (frontend requires ≥ 20.19)
- **MongoDB** (local or Atlas)
- **MetaMask** browser extension
- **Testnet ETH** on your chosen network:
  - Base Sepolia: [faucet.base.org](https://faucet.base.org)
  - Ethereum Sepolia: [sepoliafaucet.com](https://sepoliafaucet.com) or similar
- **Redis** (optional) — required for Gateway v2 metering and Studio publishing queue; defaults to `localhost:6379` or set `REDIS_DISABLED=1` to skip
- **CoFHE operator key** — the contract deployer's private key, used server-side for `deductForCall()` (see [FHE & CoFHE](#fhe--cofhe))

---

## Quick start

### 1. Deploy the smart contract

```bash
cd contract
# Create contract/.env with DEPLOYER_PRIVATE_KEY (and optional RPC URLs)
npm install
npm run compile

# Ethereum Sepolia (default CoFHE testnet)
npm run deploy

# OR Base Sepolia
npm run deploy:base
```

This writes `contract/contract_info.json`:

```json
{
  "address": "0x…",
  "chainId": 11155111,
  "minDepositWei": "1000000000000000",
  "deployer": "0x…",
  "deployedAt": "…"
}
```

Copy `address` and `chainId` into backend and frontend env (below).

### 2. Start the backend

```bash
cd backend
# Create backend/.env — see Environment variables
npm install
npm run dev
```

Default listen port is **5000**. Set `PORT=5001` (or any free port) if needed.

On startup the server logs network, FHE readiness, Redis, and optional Google/Vertex config.

### 3. Start the frontend

```bash
cd frontend
# Optional: create frontend/.env — see Environment variables
npm install
npm run dev
```

Opens **http://localhost:5173**. Vite proxies `/api` and `/outputs` to the backend.

**Important:** Match ports between backend and Vite:

| Backend `PORT` | Frontend `VITE_PROXY_TARGET` |
|----------------|------------------------------|
| `5000` (default) | `http://127.0.0.1:5000` |
| `5001` | `http://127.0.0.1:5001` |

If unset, Vite defaults the proxy to `http://127.0.0.1:5002` — change this if your backend is not on 5002.

### 4. Connect MetaMask

Add your deployment network in MetaMask:

| | Base Sepolia | Ethereum Sepolia |
|---|--------------|------------------|
| Chain ID | `84532` (`0x14a34`) | `11155111` (`0xaa36a7`) |
| RPC | `https://sepolia.base.org` | `https://ethereum-sepolia-rpc.publicnode.com` |
| Explorer | [sepolia.basescan.org](https://sepolia.basescan.org) | [sepolia.etherscan.io](https://sepolia.etherscan.io) |

Sign in via the app (challenge → `personal_sign` → JWT).

---

## Network configuration

The app supports **two CoFHE-enabled testnets**. Chain selection is driven by `contract_info.json` / `CONTRACT_ADDRESS` + `CHAIN_ID`:

| Parameter | Base Sepolia | Ethereum Sepolia |
|-----------|--------------|------------------|
| Chain ID | `84532` | `11155111` |
| Default RPC | `https://sepolia.base.org` | `https://ethereum-sepolia-rpc.publicnode.com` |
| x402 network string | `eip155:84532` | `eip155:11155111` |
| Deploy script | `npm run deploy:base` | `npm run deploy` |

Backend and frontend **must use the same chain** as the deployed contract. Mismatched `CHAIN_ID` / `VITE_CHAIN_ID` will break payments and FHE unsealing.

Public network info: `GET /api/public/network`

---

## Environment variables

### Contract (`contract/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DEPLOYER_PRIVATE_KEY` | Yes | Wallet that deploys and owns `SentinelPayment` |
| `RPC_URL` | For Sepolia | Ethereum Sepolia RPC |
| `BASE_SEPOLIA_RPC_URL` | For Base | Base Sepolia RPC (default: `https://sepolia.base.org`) |
| `ETHERSCAN_API_KEY` | Optional | Contract verification on Etherscan |
| `BASESCAN_API_KEY` | Optional | Contract verification on BaseScan |

### Backend (`backend/.env`)

**Core (required for marketplace + auth)**

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing session JWTs |
| `RPC_URL` | EVM RPC for your chain |
| `CHAIN_ID` | `84532` or `11155111` |
| `CONTRACT_ADDRESS` | `SentinelPayment` address (or rely on `contract/contract_info.json`) |
| `TREASURY_WALLET_ADDRESS` | Platform fee / subscription receiver (`0x…`) |
| `RECEIVER_WALLET` | x402 / gateway deposit receiver (alias of treasury if unset) |
| `ENCRYPTION_KEY` | 32-character AES-256 key for encrypting provider API keys at rest |
| `ETH_USD_RATE` | ETH/USD for display (e.g. `3200`) |

**FHE operator (required for prepaid balance deductions)**

| Variable | Description |
|----------|-------------|
| `OPERATOR_PRIVATE_KEY` | Contract owner key for `deductForCall()` via `@cofhe/sdk` |

> **Dev shortcut:** If `OPERATOR_PRIVATE_KEY` is unset, `loadEnv.js` reads `DEPLOYER_PRIVATE_KEY` from `contract/.env` automatically.

**Gateway v2 (optional)**

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | e.g. `redis://localhost:6379` |
| `REDIS_DISABLED` | Set `1` to skip Redis entirely |
| `GATEWAY_ADMIN_WALLETS` | Comma-separated admin addresses |
| `ETH_USD` | USD rate for gateway metering |

**AI Studio (optional — enables specific tools)**

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Prompt generator, blog, workflow images |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
| `GOOGLE_CLOUD_PROJECT` | GCP project for Vertex Imagen/Veo |
| `GCS_ASSETS_BUCKET` | Bucket for pipeline/workflow asset URLs |
| `VERTEX_IMAGEN_ENABLED` | `true` for Imagen instead of Gemini images |
| `GROQ_API_KEY` | Groq-backed agents |

**Server**

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `production` serves `frontend/dist` as SPA |

See also `docs/POST_DEPLOYMENT_GUIDE.md` and `docs/STUDIO_REVENUE_MODEL.md` for Studio overage rates.

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_CHAIN_ID` | Must match deployed contract (`84532` or `11155111`) |
| `VITE_RPC_URL` | Optional RPC override |
| `VITE_CONTRACT_ADDRESS` | Optional; fetched from API if unset |
| `VITE_PROXY_TARGET` | Backend URL for Vite dev proxy (default `http://127.0.0.1:5002`) |

---

## Smart contract

`SentinelPayment.sol` stores user balances as **`euint64`** (FHE-encrypted wei) on-chain.

| Function | Who | Purpose |
|----------|-----|---------|
| `deposit()` | User | Payable — adds `msg.value` to encrypted balance |
| `deductForCall(user, encAmount, service)` | Owner (operator) | Subtract encrypted charge after AI call |
| `sealedBalance()` | User | Returns ciphertext for client-side unseal |
| `hasBalance(user)` | Anyone | Plaintext bool — safe to expose |
| `withdraw(amount)` | Owner | Treasury withdrawal |
| `setMinDeposit(wei)` | Owner | Minimum deposit (default 0.001 ETH at deploy) |

**Privacy model:** Deposit amounts are visible on-chain (`msg.value` is public). **Per-call deductions** use encrypted amounts — observers cannot learn charge sizes from `deductForCall` calldata alone.

Compile and test:

```bash
cd contract
npm run compile
npm test
```

---

## Payment flows

### Marketplace (2-step MetaMask purchase)

1. User browses `/marketplace/browse`, selects a service
2. `POST /api/payment/create` → `{ receiver, amountWei }`
3. User confirms ETH transfer in MetaMask
4. `POST /api/payment/verify` with `{ txHash }` → backend confirms receipt → issues `sk-sentinel-*` API key
5. User calls the service with the API key via `POST /api/use`

### x402 keyless (session key auto-pay)

1. User enables session key (`POST /api/profile/session-key`)
2. `POST /api/use` without payment → **HTTP 402** with `{ payTo, amountWei, network }`
3. Session key wallet sends ETH to `payTo` (no MetaMask popup)
4. Retry with `X-Payment: base64({ txHash, network, amount, payTo })`
5. `verifyX402Payment()` checks receipt → AI response + `sentinelReceipt.explorerUrl`

Frontend helper:

```javascript
import { callProxyX402Use } from "./api/proxyX402Use.js";

const { aiResponse, txHash, explorerUrl } = await callProxyX402Use({
  apiKey: "sk-sentinel-…",
  serviceId: "…",
  body: { messages: [{ role: "user", content: "Hello" }] },
});
```

### FHE contract top-up (prepaid encrypted balance)

1. `POST /api/wallet/topup/create` → payment intent + amount
2. User calls `SentinelPayment.deposit()` via MetaMask (`depositToSentinel`)
3. `POST /api/wallet/topup/verify` with `{ txHash, paymentIntentId }`
4. User unseals balance: `sealedBalance()` + `cofhejs.unseal(result, FheTypes.Uint64)`
5. Subsequent `POST /api/use` calls deduct via `deductForCall()` — **no x402 popup**

Dashboard: `/dashboard/contract` (On-Chain Contract page)

### Gateway v2 (Redis prepaid proxy)

1. Consumer deposits ETH to gateway vault
2. Subscribes to an API slug in Gateway Marketplace
3. Calls `POST /proxy/:slug` — Redis balance debited per request
4. Developers track earnings and request payouts

See [docs/GATEWAY_V2.md](docs/GATEWAY_V2.md).

### AI Studio subscriptions + overage

1. User selects a plan on `/studio/plan`
2. Pays monthly subscription in ETH via MetaMask
3. Studio runs consume credits from the monthly pool
4. When credits are exhausted, overage is billed per-run in ETH via x402

See [docs/STUDIO_REVENUE_MODEL.md](docs/STUDIO_REVENUE_MODEL.md).

---

## Authentication

MetaMask wallet auth (no passwords):

```
POST /api/auth/challenge     → { nonce, message }
     MetaMask personal_sign
POST /api/auth/login         → { token, user }
```

Protected routes send `Authorization: Bearer <jwt>`.

Creators: `POST /api/auth/become-creator` after login.

---

## API overview

| Prefix | Purpose |
|--------|---------|
| `GET /api/health` | Liveness check |
| `GET /api/public/network` | Chain ID, RPC, explorer, receiver wallet |
| `/api/auth` | Challenge, login, registration, become-creator |
| `/api/services` | Marketplace service catalog |
| `/api/payment` | Create/verify marketplace purchases |
| `/api/use` | Main AI proxy (API key, x402, FHE) |
| `/api/x402` | Authenticated per-service x402 calls |
| `/api/wallet` | FHE top-up intents and history |
| `/api/contract` | On-chain contract stats |
| `/api/creator` | Creator dashboard, webhooks, earnings |
| `/api/profile` | User profile, session keys, burner wallet |
| `/api/gateway` | Gateway v2 admin, deposits, subscriptions |
| `/api/studio` | Studio tools, blog, projects, analytics |
| `/api/workflows` | Workflow CRUD, estimate, execute |
| `/proxy/:slug` | Gateway consumer proxy endpoint |

x402 headers exposed by CORS: `Payment-Required`, `X-Payment`, `X-Payment-Response`.

---

## Frontend

Major routes (React Router):

| Route | Page |
|-------|------|
| `/` | Marketing homepage + FHE demo widget |
| `/marketplace/browse` | Service catalog |
| `/marketplace/service/:id` | Service detail + purchase |
| `/dashboard` | User dashboard |
| `/dashboard/contract` | FHE wallet top-up + balance |
| `/creator` | Creator dashboard |
| `/studio` | AI Studio hub |
| `/studio/plan` | Subscription tiers |
| `/gateway` | Gateway marketplace |
| `/workflows` | Workflow Studio |
| `/docs/*` | In-app documentation |
| `/sdk-demo`, `/fhe-compute` | CoFHE integration demos |

Production build:

```bash
# From repo root — builds frontend, backend serves SPA
npm run build
NODE_ENV=production npm start
```

---

## FHE & CoFHE

- Balances are **`euint64`** ciphertexts in `SentinelPayment.sol`
- Backend encrypts deduction amounts with **`@cofhe/sdk/node`** before `deductForCall()`
- Frontend unseals with a user permit: `cofhejs.unseal(result, FheTypes.Uint64)`
- Operator must be the **contract owner** (`OPERATOR_PRIVATE_KEY` = deployer)
- Startup logs `[fhe] ready` or the reason FHE is disabled

Resources:

- [CoFHE documentation](https://cofhe-docs.fhenix.zone/)
- npm: `@cofhe/sdk`, `@fhenixprotocol/cofhe-contracts`, `@cofhe/hardhat-plugin`
- In-repo reference: `cofhesdk/` monorepo, `AGENTS.md`

---

## Production deployment

1. Deploy `SentinelPayment` to your target testnet/mainnet
2. Set all backend env vars (MongoDB Atlas, JWT, RPC, contract address, operator key)
3. Build from repo root: `npm run build`
4. Start: `NODE_ENV=production npm start` (serves API + `frontend/dist`)
5. Verify checklist in [docs/POST_DEPLOYMENT_GUIDE.md](docs/POST_DEPLOYMENT_GUIDE.md):
   - MetaMask connects on correct chain
   - x402 returns 402 then 200 with valid explorer link
   - FHE top-up + deduction works
   - Studio subscription + overage modal shows ETH amounts

**Render / similar:** Use repo-root `npm run build` as build command (not `backend/` alone) so `frontend/dist` exists.

---

## Further documentation

| Document | Contents |
|----------|----------|
| [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) | Step-by-step auth, marketplace, x402, FHE integration |
| [docs/POST_DEPLOYMENT_GUIDE.md](docs/POST_DEPLOYMENT_GUIDE.md) | Production env + verification checklist |
| [docs/GATEWAY_V2.md](docs/GATEWAY_V2.md) | Gateway prepaid billing architecture |
| [docs/STUDIO_REVENUE_MODEL.md](docs/STUDIO_REVENUE_MODEL.md) | Studio tiers, credits, overage ETH rates |
| [AGENTS.md](AGENTS.md) | Condensed architecture for AI-assisted development |

---

## License

MIT
