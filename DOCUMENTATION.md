# Sentinel — Pay-Per-Usage AI API Access System on Algorand

## Complete Technical Documentation

> **Project Name:** Sentinel (SentinelAI)
> **Blockchain:** Algorand TestNet
> **Stack:** MERN (MongoDB, Express, React, Node.js) + Algorand Smart Contracts (Puya/algopy)
> **Team:** Aarya Pawar, Manas Shete, Debjit Debnath, Aayush Lathi

---

## Table of Contents

1. [Project Overview & Business Model](#1-project-overview--business-model)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Repository Structure](#3-repository-structure)
4. [Technical Glossary](#4-technical-glossary)
5. [Backend — Detailed Breakdown](#5-backend--detailed-breakdown)
   - [Entry Point & Server Configuration](#51-entry-point--server-configuration)
   - [Database Layer (Models)](#52-database-layer-models)
   - [Authentication & Middleware](#53-authentication--middleware)
   - [API Routes](#54-api-routes)
   - [Services (Business Logic)](#55-services-business-logic)
   - [Config & Utilities](#56-config--utilities)
   - [Seed Data](#57-seed-data)
   - [Migrations](#58-migrations)
6. [Frontend — Detailed Breakdown](#6-frontend--detailed-breakdown)
   - [App Entry & Routing](#61-app-entry--routing)
   - [Pages](#62-pages)
   - [Components](#63-components)
   - [Hooks](#64-hooks)
   - [Context (State Management)](#65-context-state-management)
   - [Wallet Integration](#66-wallet-integration)
   - [API Client & Utilities](#67-api-client--utilities)
7. [Smart Contract — Detailed Breakdown](#7-smart-contract--detailed-breakdown)
   - [Contract Source (Puya/algopy)](#71-contract-source-puyaalgopy)
   - [Deployment Script](#72-deployment-script)
   - [Compiled Artifacts](#73-compiled-artifacts)
8. [Core Flows — Step-by-Step](#8-core-flows--step-by-step)
   - [User Login Flow (Firebase / Google)](#81-user-login-flow-firebase--google)
   - [Service Creation Flow (Creator)](#82-service-creation-flow-creator)
   - [Pay-Per-Use AI API Call Flow](#83-pay-per-use-ai-api-call-flow)
   - [Burner Wallet Flow](#84-burner-wallet-flow)
   - [Direct Payment & Access Token Flow](#86-direct-payment--access-token-flow)
   - [Top-Up (Contract) Flow](#87-top-up-contract-flow)
   - [Proof-of-Intelligence Flow](#88-proof-of-intelligence-flow)
9. [Agent Context JSON](#10-agent-context-json)
11. [x402 Payment Protocol (Roadmap)](#11-x402-payment-protocol-roadmap)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [API Reference (All Endpoints)](#13-api-reference-all-endpoints)
14. [Security Mechanisms](#14-security-mechanisms)
15. [Prediction & Analytics Engine](#15-prediction--analytics-engine)

---

## 1. Project Overview & Business Model

Sentinel is a **decentralized pay-per-use AI API marketplace** built on the **Algorand blockchain**. It solves the problem of trust and cost transparency in AI API access:

- **Creators** (AI service providers) publish AI services — wrapping models from **Groq, OpenAI, Anthropic, or Together AI** — and set **per-token ALGO pricing**.
- **Users** (consumers) discover services on the marketplace, pay **on-chain in ALGO** for each API call, and receive AI responses only after verified payment.
- The platform acts as a **secure proxy** — the creator's provider API key is **never exposed**. It is stored AES-256-GCM encrypted and only decrypted server-side at call time.
- Each payment is a direct, **peer-to-peer Algorand transaction** from user wallet → creator wallet. No custodial intermediary holds funds.
- An optional **Algorand smart contract** (`SentinelContract`) tracks global platform stats on-chain.

### Business Model

| Participant | Role | Revenue mechanism |
|-------------|------|-------------------|
| **Creators** | Publish AI services, set pricing | Receive 100% of user payments directly to their Algorand wallet |
| **Users** | Consume AI services | Pay per call in ALGO — no subscription needed |
| **Platform** | Runs the marketplace + Studio | Studio subscription fees (Creator 5 ALGO/mo · Pro 15 · Enterprise 40); 0.001 ALGO proof-of-intelligence log fee per call |

**Key design properties:**
- Zero platform cut on marketplace transactions — all ALGO flows creator → user directly.
- The **Burner Wallet** lets users pre-fund a hot wallet so automated clients (and future AI agents) can pay without a manual Pera Wallet signature per message.
- The **Agent Context JSON** endpoint allows any external AI assistant to read the live service catalog and recommend APIs — positioning Sentinel as a **machine-native marketplace**.
- The planned **x402 protocol** endpoint will allow AI agents to call Sentinel services using the emerging HTTP 402 payment standard, without any Sentinel-specific client code.

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Main SPA (React + Vite :5173)                                       │
│  Home ──► Pera Wallet login ──► Role                                 │
│  Marketplace ──► Service Detail (pay-per-use)                        │
│  Dashboard (Agent Context JSON panel)                                │
│  Studio (blog, projects, platforms)                                │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ Vite Proxy /api → :5000
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  MAIN BACKEND (:5000) — Express + MongoDB                            │
│  /api/auth · /api/services · /api/use · /api/profile/burner          │
│  /api/access · /api/payment · /api/creator · /api/studio             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
     ┌───────────────────────┴────────────────────────────────────────┐
     │  MongoDB (Atlas) · Redis (BullMQ) · Algorand TestNet              │
     │  Groq / OpenAI / Anthropic / Together                             │
     └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Repository Structure

```
pay-per-usage-ai-api-access-system-using-algorand/
│
├── README.md                          # Project overview
├── DOCUMENTATION.md                   # ◄── This file
│
├── backend/                           # Express.js API server
│   ├── .env                           # Environment variables (secrets)
│   ├── package.json                   # Node.js dependencies & scripts
│   ├── seed/
│   │   └── seedTransactions.js        # Seed script for demo transaction data
│   └── src/
│       ├── server.js                  # Express app entry point
│       ├── config/
│       │   ├── db.js                  # MongoDB connection + startup migrations
│       │   └── contractConfig.js      # Reads Algorand app ID from env/JSON
│       ├── middleware/
│       │   └── auth.js                # JWT verification, role guard
│       ├── migrations/
│       │   └── servicePricing.js      # One-time migration: flat price → token pricing
│       ├── models/
│       │   ├── User.js                # User schema (walletAddress, role)
│       │   ├── Service.js             # AI service listing (pricing, encrypted key)
│       │   ├── Transaction.js         # Payment intent tracking
│       │   ├── AccessToken.js         # Per-service API keys for users
│       │   ├── ApiUsageLog.js         # Detailed per-call usage logs
│       │   └── TopUpIntent.js         # Contract top-up intent tracking
│       ├── routes/
│       │   ├── auth.js                # POST /login — wallet-based JWT login
│       │   ├── services.js            # CRUD: list, get, create, update, delete
│       │   ├── payment.js             # Payment create (intent) + verify (on-chain)
│       │   ├── access.js              # Generate/list access tokens
│       │   ├── use.js                 # Core metered AI API (quote + complete)
│       │   ├── creator.js             # Creator stats, services, usage logs
│       │   ├── user.js                # User balance, proxy keys, transactions
│       │   ├── wallet.js              # Contract top-up intents (create + verify)
│       │   ├── contract.js            # On-chain contract stats endpoint
│       │   └── prediction.js          # Usage forecasting engine
│       ├── services/
│       │   ├── aiProxy.js             # Forwards requests to Groq/OpenAI/Anthropic/Together
│       │   ├── algorandService.js     # Algorand Indexer & transaction utilities
│       │   ├── billing.js             # Token counting & charge computation
│       │   ├── contractAlgod.js       # Reads global state from on-chain contract
│       │   ├── pendingUseCache.js     # In-memory cache for quote→pay→complete flow
│       │   └── proofOfIntelligence.js # On-chain attestation of AI interactions
│       └── utils/
│           ├── encrypt.js             # AES-256-GCM encrypt/decrypt for API keys
│           └── userWallet.js          # Wallet address normalization & migration
│
├── frontend/                          # Vite + React + Tailwind SPA
│   ├── .env                           # Optional VITE_API_URL
│   ├── package.json
│   ├── vite.config.js                 # React plugin, Node polyfills, dev proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx                   # React root with BrowserRouter + AuthProvider
│       ├── App.jsx                    # Route definitions + role-based Guards
│       ├── index.css                  # Global Tailwind styles
│       ├── api/
│       │   └── client.js              # Axios instance + auth token header
│       ├── context/
│       │   └── AuthContext.jsx        # Global auth state (JWT token + user)
│       ├── hooks/
│       │   └── useTokenEstimate.js    # Live ALGO cost estimate from prompt length
│       ├── wallet/
│       │   └── pera.js                # PeraWallet connect/sign/send abstraction
│       ├── utils/
│       │   ├── apiBase.js             # API base URL resolver
│       │   ├── jwt.js                 # Client-side JWT payload decoder
│       │   └── tokenPricing.js        # Client-side charge calculation helpers
│       ├── pages/
│       │   ├── Home.jsx               # Landing page + wallet login
│       │   ├── UserMarketplace.jsx    # Browse all services
│       │   ├── ServiceDetail.jsx      # Use a specific AI service
│       │   ├── UserDashboard.jsx      # User overview, balance, keys
│       │   ├── TransactionHistory.jsx # Filterable transaction list
│       │   ├── PredictionDashboard.jsx# AI-powered spending analytics
│       │   ├── CreatorDashboard.jsx   # Creator stats, manage services
│       │   └── CreateService.jsx      # Form to publish new AI service
│       └── components/
│           ├── ContractStats.jsx      # Displays on-chain contract statistics
│           ├── UserLiveWalletBar.jsx  # Live ALGO balance bar for users
│           └── ErrorBoundary.jsx      # React error boundary wrapper
│
└── contract/                          # Algorand smart contract (Puya/algopy)
    ├── sentinel_contract.py           # Smart contract source code
    ├── deploy.py                      # Deployment script (compile + deploy to TestNet)
    ├── requirements.txt               # Python deps: algopy, puyapy, py-algorand-sdk
    ├── contract_info.json             # Deployed appId + contractAddress (output of deploy.py)
    └── artifacts/                     # Compiled TEAL + ARC56 JSON (Puya output)
        ├── SentinelContract.approval.teal
        ├── SentinelContract.clear.teal
        ├── SentinelContract.arc56.json
        ├── SentinelContract.approval.puya.map
        └── SentinelContract.clear.puya.map
```

---

## 4. Technical Glossary

| Term | Definition |
|------|-----------|
| **ALGO** | The native cryptocurrency of the Algorand blockchain. 1 ALGO = 1,000,000 **microAlgos**. |
| **microAlgos** | The smallest unit of ALGO. All on-chain amounts are expressed in microAlgos (integers). |
| **Algorand TestNet** | A test version of the Algorand blockchain for development. Tokens have no real value. |
| **Algod** | The Algorand node daemon. Exposes REST APIs for submitting transactions and querying chain state. |
| **Indexer** | An Algorand service that indexes blockchain data and provides advanced query capabilities (e.g., lookup a transaction by ID). |
| **Pera Wallet** | A mobile/web wallet for Algorand. Users sign transactions with it. This project uses `@perawallet/connect`. |
| **JWT (JSON Web Token)** | A compact, URL-safe token used for authentication. The backend issues JWTs signed with `JWT_SECRET` after wallet login. |
| **AES-256-GCM** | Advanced Encryption Standard with 256-bit key and Galois/Counter Mode. Used to encrypt creator API keys at rest in the database. |
| **Puya / algopy** | The Python-to-TEAL compiler for Algorand. Allows writing smart contracts in Python that compile to TEAL (Transaction Execution Approval Language). |
| **TEAL** | Transaction Execution Approval Language — the low-level smart contract language for Algorand. |
| **ARC4** | Algorand Request for Comments #4 — the ABI (Application Binary Interface) standard for calling smart contract methods. |
| **ARC56** | An extended ABI specification format that includes source maps and additional metadata. |
| **Payment Intent** | A server-generated UUID that identifies a specific payment request. Embedded in the transaction note for verification. |
| **Access Token** | A `sk-sentinel-*` prefixed API key generated after a verified payment. Used to authenticate `/api/use` calls. |
| **Proof-of-Intelligence** | An on-chain attestation: a minimal Algorand payment with a `proof of intelligence:<sha256>` note, recording a hash of the AI interaction. |
| **Replay Attack** | An attack where a valid transaction is resubmitted. Prevented by unique `paymentIntentId` and `paymentRef` checks. |
| **Token (AI)** | A unit of text processed by an AI model. Roughly ~1.33 tokens per English word. Billing is per 1,000 tokens. |
| **pricePerThousandTokens** | The ALGO cost per 1,000 tokens (input + output combined) set by the service creator. |
| **minimumChargeAlgo** | A floor charge per API call in ALGO. Even if the token cost is lower, this minimum is charged. |
| **OLS (Ordinary Least Squares)** | A linear regression method used by the prediction engine to forecast future spending trends. |
| **WMA (Weighted Moving Average)** | An alternative prediction model that weights recent months more heavily. |

---

## 5. Backend — Detailed Breakdown

### 5.1 Entry Point & Server Configuration

**File:** `backend/src/server.js`

- Loads environment variables via `dotenv/config`.
- Enables `express-async-errors` to catch async route errors globally.
- Configures **Helmet** (HTTP security headers) and **CORS** (allows the frontend origin).
- JSON body parser limited to **1 MB**.
- Exposes a health check at `GET /api/health` and network info at `GET /api/public/network`.
- Mounts all 10 route modules under `/api/`.
- Global error handler catches `CastError` (400), `ValidationError` (400), and generic errors (500). In development mode, error details are returned in the `detail` field.
- Connects to MongoDB (via `connectDb()`) then starts listening on `PORT` (default 5000).

### 5.2 Database Layer (Models)

All models use **Mongoose** (MongoDB ODM) with ES module imports.

#### User (`models/User.js`)
| Field | Type | Details |
|-------|------|---------|
| `walletAddress` | String | **Unique**, required. Canonical Algorand address. |
| `role` | String | `"user"` or `"creator"`. |
| `createdAt` | Date | Auto-generated. |

#### Service (`models/Service.js`)
| Field | Type | Details |
|-------|------|---------|
| `title` | String | Service name. |
| `description` | String | Optional description. |
| `pricePerThousandTokens` | Number | ALGO per 1K tokens. |
| `minimumChargeAlgo` | Number | Floor charge per call (ALGO). |
| `creatorWallet` | String | Creator's Algorand address (indexed). |
| `totalUses` | Number | Cumulative call count. |
| `totalRevenue` | Number | Cumulative ALGO earned. |
| `aiProvider` | String | `"groq"`, `"openai"`, `"anthropic"`, or `"together"`. |
| `encryptedApiKey` | String | AES-256-GCM encrypted provider API key. **Never exposed via API.** |
| `modelName` | String | e.g., `"llama-3.1-70b-versatile"`, `"gpt-4o"`. |
| `isPaused` | Boolean | Creator can pause their service. |

#### Transaction (`models/Transaction.js`)
| Field | Type | Details |
|-------|------|---------|
| `userWallet` | String | Payer's wallet. |
| `serviceId` | ObjectId | Ref to `Service`. |
| `amount` | Number | ALGO amount. |
| `txId` | String | Algorand transaction ID (unique when set). |
| `status` | String | `"pending"`, `"verified"`, or `"failed"`. |
| `paymentIntentId` | String | UUID, unique. Prevents duplicate payments. |

#### AccessToken (`models/AccessToken.js`)
| Field | Type | Details |
|-------|------|---------|
| `userWallet` | String | Indexed. |
| `serviceId` | ObjectId | Ref to `Service`. |
| `key` | String | The `sk-sentinel-<hex>` API key. Unique. |
| `isUsed` | Boolean | Tracks if the key has been consumed. |

#### ApiUsageLog (`models/ApiUsageLog.js`)
The most detailed model — records **every** AI API call with full billing audit trail.

| Field | Type | Details |
|-------|------|---------|
| `userWallet` | String | Who made the call. |
| `serviceId` | ObjectId | Which service was used. |
| `accessTokenId` | ObjectId | Which access token authenticated the call. |
| `developerWallet` | String | Creator who received payment. |
| `amountAlgo` | Number | ALGO charged. |
| `aiProvider` | String | e.g., `"groq"`. |
| `modelName` | String | e.g., `"llama3-70b"`. |
| `paymentTxId` | String | On-chain transaction ID. Has a **partial unique index** (only when `success: true` and non-empty) to prevent replay attacks. |
| `paymentRef` | String | UUID linking quote to completion. |
| `success` | Boolean | Whether the call succeeded. |
| `errorDetail` | String | Error message if failed. |
| `promptTokens` | Number | Input token count. |
| `completionTokens` | Number | Output token count. |
| `totalTokens` | Number | Total token count. |
| `chargeAlgo` | Number | Computed ALGO charge. |
| `pricePerThousandTokens` | Number | Rate snapshot at time of call. |
| `proofTxId` | String | On-chain proof-of-intelligence transaction ID. |

#### TopUpIntent (`models/TopUpIntent.js`)
| Field | Type | Details |
|-------|------|---------|
| `userWallet` | String | User initiating top-up. |
| `paymentIntentId` | String | UUID, unique. |
| `amountMicroAlgos` | Number | Minimum payment amount. |
| `status` | String | `"pending"` or `"verified"`. |
| `txId` | String | Algorand transaction ID. |

### 5.3 Authentication & Middleware

**File:** `backend/src/middleware/auth.js`

Two middleware functions:

1. **`requireAuth(req, res, next)`**
   - Extracts `Bearer <token>` from the `Authorization` header.
   - Verifies the JWT using `JWT_SECRET`.
   - Sets `req.user = { walletAddress, role, userId }`.
   - Returns `401` if missing/invalid.

2. **`requireRole(...roles)`**
   - Returns a middleware that checks `req.user.role` against an allowed list.
   - Returns `403 Forbidden` if the user's role isn't permitted.

### 5.4 API Routes

#### `POST /api/auth/login` — Wallet Login
**File:** `routes/auth.js`
- **Input:** `{ walletAddress: string, role: "user" | "creator" }`
- Validates the Algorand address format.
- Canonicalizes the address (encode → decode roundtrip).
- Migrates any legacy non-canonical wallet references in `AccessToken`, `Transaction`, `ApiUsageLog`.
- Creates or finds the `User` document, updating role if changed.
- Returns a **JWT** (7-day expiry) with `{ sub, walletAddress, role }`.

#### `GET /api/services` — List All Services
#### `GET /api/services/:id` — Get Single Service
#### `POST /api/services` — Create Service (Creator)
#### `PATCH /api/services/:id` — Update Service (Creator)
#### `DELETE /api/services/:id` — Delete Service (Creator)
**File:** `routes/services.js`
- GET routes are **public** (no auth required).
- POST/PATCH/DELETE require `requireAuth` + `requireRole("creator")`.
- The `encryptedApiKey` field is **always stripped** from responses.
- Creating a service encrypts the provider API key with AES-256-GCM before storing.

#### `POST /api/payment/create` — Create Payment Intent
#### `POST /api/payment/verify` — Verify On-Chain Payment
**File:** `routes/payment.js`
- **Create:** Generates a UUID `paymentIntentId`, computes `amountMicroAlgos` from `minimumChargeAlgo`, saves a `Transaction` with status `"pending"`. Returns payment instructions (receiver, amount, note format `sentinal:<uuid>`).
- **Verify:** Looks up the Algorand transaction on the Indexer (with retry), validates sender/receiver/amount/note match the intent, marks the transaction `"verified"`, increments `Service.totalRevenue`, and creates an `AccessToken` (`sk-sentinel-<hex>`).

#### `POST /api/access/generate` — Generate Access Token
#### `GET /api/access/:serviceId` — List Access Tokens
**File:** `routes/access.js`
- Generates `sk-sentinel-<random hex>` API keys tied to a user wallet + service.
- Reuses existing token if one already exists for the user/service pair.

#### `POST /api/use` — Core Metered AI API
**File:** `routes/use.js`

This is the **most complex route** — the heart of the pay-per-use system. It has two modes based on whether `txId` is present:

**Mode 1 — Invoke (Quote):** `POST /api/use` with `{ messages/prompt, ... }` (no `txId`)
1. Resolves the Access Token from `X-API-Key` or `Authorization` header.
2. Decrypts the creator's provider API key.
3. Forwards the request to the AI provider (Groq/OpenAI/Anthropic/Together).
4. Extracts token usage from the response.
5. Computes the charge: `max(totalTokens/1000 * pricePerThousandTokens, minimumChargeAlgo)`.
6. Caches the AI response + metadata in an **in-memory pending map** (60-second TTL).
7. Returns `{ awaitingPayment: true, paymentRef, chargeAlgo, developerWallet, ... }`.
   - The AI response is **NOT** returned at this stage.

**Mode 2 — Complete:** `POST /api/use` with `{ txId, paymentRef, ... }`
1. Checks for replay (same `txId` already used successfully).
2. Retrieves the cached pending session (fails if expired/missing).
3. Looks up the transaction on the Algorand Indexer (with retry + polling).
4. Validates: sender = user wallet, receiver = creator wallet, amount ≈ quoted charge (±1% tolerance), note = `paymentRef`.
5. Creates an `ApiUsageLog` with `success: true`.
6. Asynchronously submits a **proof-of-intelligence** transaction.
7. Returns the cached AI response + a `sentinelReceipt`.

Rate limited to **30 requests/minute** per API key (or IP if no key).

#### `GET /api/creator/services` — Creator's Services
#### `GET /api/creator/stats` — Creator Dashboard Stats
#### `GET /api/creator/usage` — Creator Usage Logs
**File:** `routes/creator.js`
- Aggregates revenue, calls, and tokens served across all services owned by the creator.
- Uses MongoDB aggregation pipeline on `ApiUsageLog`.

#### `GET /api/user/algo-balance` — Live ALGO Balance
#### `GET /api/user/proxy-keys` — User's API Keys
#### `GET /api/user/transactions` — Transaction History (Filterable)
#### `GET /api/user/usage` — Simple Usage Logs
**File:** `routes/user.js`
- `algo-balance` queries the Algorand Indexer for the user's on-chain ALGO balance.
- `transactions` supports filters: `serviceId`, `startDate`, `endDate`, `sortBy` (newest/oldest/highest_charge/lowest_charge).

#### `POST /api/wallet/topup/create` — Create Top-Up Intent
#### `POST /api/wallet/topup/verify` — Verify Top-Up
**File:** `routes/wallet.js`
- Creates an intent to pay into the **SentinelContract** application address.
- Reads `min_payment` from the on-chain contract global state.
- Verifies the transaction receiver is the contract address, amount ≥ minimum, and note matches.

#### `GET /api/contract/stats` — Contract On-Chain Stats
**File:** `routes/contract.js`
- Reads `total_purchases`, `total_algo_received`, `min_payment` from the smart contract's global state.
- Cached for 20 seconds to avoid excessive Algod calls.

#### `GET /api/prediction/usage` — Spending Prediction
#### `GET /api/prediction/history` — Raw Monthly History
**File:** `routes/prediction.js`
- See [Section 12: Prediction & Analytics Engine](#12-prediction--analytics-engine).

### 5.5 Services (Business Logic)

#### AI Proxy (`services/aiProxy.js`)
- Unified `forwardChatCompletion()` function that accepts an OpenAI-compatible `{ messages, model, max_tokens }` body.
- Routes to the correct provider endpoint:
  - **Groq:** `https://api.groq.com/openai/v1/chat/completions`
  - **OpenAI:** `https://api.openai.com/v1/chat/completions`
  - **Together:** `https://api.together.xyz/v1/chat/completions`
  - **Anthropic:** `https://api.anthropic.com/v1/messages` (converts message format, handles system prompt separately)
- Anthropic responses are **normalized** to match the OpenAI `{ choices: [...] }` format.
- 120-second timeout. Returns HTTP 429 (rate limited) or 502 (upstream error).

#### Algorand Service (`services/algorandService.js`)
- **`lookupTransactionByIDWithRetry(txId)`** — Retries up to 12 times (1.5s delay) because the Indexer can lag behind the network.
- **`lookupConfirmedTransactionOnIndexer(txId)`** — Polls until the transaction has a confirmed round > 0.
- **`parsePaymentFromIndexer(txInfo)`** — Extracts `sender`, `receiver`, `amount`, `note` from an Indexer response.
- **`normalizeAlgoAddress(addr)`** — Canonical form via `encodeAddress(decodeAddress(addr))`.
- **`fetchAccountBalanceMicroAlgos(address)`** — Returns native ALGO balance from the Indexer.
- **`algoToMicroAlgos(algo)`** — Converts ALGO to microAlgos (× 1,000,000).
- **`decodeNote(noteField)`** — Handles Uint8Array, Buffer, and base64 encoded notes.

#### Billing (`services/billing.js`)
- **`estimateTokensFromOpenAiMessages(messages)`** — Approximates token count: `words × 4/3`.
- **`extractTokenUsage(provider, data)`** — Extracts `{ promptTokens, completionTokens, totalTokens }` from provider response, handling Anthropic's `input_tokens`/`output_tokens` naming.
- **`computeChargeAlgo(totalTokens, pricePerThousandTokens, minimumChargeAlgo)`** — `max(tokens/1000 × rate, minimum)`, rounded to 6 decimal places.
- **`microAlgosWithinTolerance(paid, expected, tolerancePercent)`** — Allows ±1% variance in payment verification (handles rounding).

#### Pending Use Cache (`services/pendingUseCache.js`)
- **In-memory** `Map<paymentRef, { timer, payload }>`.
- `registerPending(paymentRef, payload)` — Stores the AI response + charge details with a **60-second TTL**. If the user doesn't pay within 60s, the session becomes an `ApiUsageLog` with `success: false` and `errorDetail: "payment_timeout"`.
- `consumePending(paymentRef)` — Retrieves and removes the cached session. Returns `null` if expired.

#### Proof of Intelligence (`services/proofOfIntelligence.js`)
- Creates a **SHA-256 hash** of `prompt|response|userWallet|serviceId|timestamp`.
- Sends a 0.001 ALGO on-chain transaction from the platform wallet to a proof log address with note `proof of intelligence:<hash>`.
- Requires `PLATFORM_MNEMONIC` and `PROOF_LOG_ADDRESS` env vars.
- Non-blocking: runs asynchronously after the API response is delivered.

#### Contract Algod (`services/contractAlgod.js`)
- Reads the **global state** of the SentinelContract application:
  - `min_payment` — Minimum top-up in microAlgos.
  - `total_purchases` — Number of on-chain purchases.
  - `total_algo_received` — Cumulative ALGO received (microAlgos).
- Handles both Puya field names and positional fallback for key ordering.

### 5.6 Config & Utilities

#### Database Connection (`config/db.js`)
- Connects to MongoDB using `MONGODB_URI` or `MONGO_URI`.
- Runs `migrateServicePricing()` on startup.
- Syncs indexes for `Transaction` and `TopUpIntent`.

#### Contract Config (`config/contractConfig.js`)
- Reads `appId` and `contractAddress` from:
  1. Environment variables `ALGO_APP_ID` / `ALGO_CONTRACT_ADDRESS`.
  2. Fallback: `contract/contract_info.json` file.

#### Encryption (`utils/encrypt.js`)
- `deriveKey()` — SHA-256 hashes `ENCRYPTION_KEY` to get a 32-byte AES key.
- `encryptSecret(plain)` — AES-256-GCM encrypt. Returns base64 of `IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext`.
- `decryptSecret(b64)` — Reverses the process. Used server-side only to decrypt creator API keys at call time.

#### Wallet Utilities (`utils/userWallet.js`)
- `canonicalWalletAddress(raw)` — Validates and normalizes Algorand addresses.
- `migrateWalletAliasesToCanonical(canonical, raw)` — Updates `AccessToken`, `Transaction`, `ApiUsageLog` records that used the old raw format.
- `sameWallet(a, b)` — Compares two addresses in canonical form.
- `creatorServicesOwnedBy(wallet)` — Returns a Mongo query that matches services by canonical or raw wallet.

### 5.7 Seed Data

**File:** `backend/seed/seedTransactions.js`
- Populates MongoDB with 6 months of realistic demo transactions across 3 fake wallets.
- Usage profiles show growth trends (useful for testing the prediction engine).
- Run: `node seed/seedTransactions.js` (optionally `--clear` to wipe first).

### 5.8 Migrations

**File:** `backend/src/migrations/servicePricing.js`
- One-time migration that converts legacy flat `price` field to:
  - `pricePerThousandTokens = price / 500`
  - `minimumChargeAlgo = max(price / 10, 0.001)`
- Removes the deprecated `price` field.

---

## 6. Frontend — Detailed Breakdown

**Stack:** Vite + React 18 + Tailwind CSS 3 + React Router 7

### 6.1 App Entry & Routing

**File:** `frontend/src/App.jsx`

| Route | Page | Role |
|-------|------|------|
| `/` | Home (Login) | Public |
| `/user/marketplace` | Browse AI Services | `user` |
| `/user/services/:id` | Service Detail + AI Chat | `user` |
| `/user/dashboard` | User Overview | `user` |
| `/user/transactions` | Transaction History | `user` |
| `/user/analytics` | Prediction Dashboard | `user` |
| `/creator` | Creator Dashboard | `creator` |
| `/creator/new` | Create New Service | `creator` |

A `Guard` component wraps protected routes: if the user is not authenticated, redirect to `/`; if wrong role, redirect to the correct dashboard.

### 6.2 Pages

| Page | File | Description |
|------|------|-------------|
| **Home** | `Home.jsx` | Landing page. "Connect Wallet" button triggers Pera Wallet connection, then role selection (User/Creator). Calls `POST /api/auth/login`. |
| **UserMarketplace** | `UserMarketplace.jsx` | Lists all services with search, pricing info. Click to go to ServiceDetail. |
| **ServiceDetail** | `ServiceDetail.jsx` | Full AI interaction page. User writes a prompt, sees a real-time cost estimate, sends the prompt (quote step), signs an Algorand payment via Pera Wallet, and receives the AI response (complete step). |
| **UserDashboard** | `UserDashboard.jsx` | Overview of user's API keys, wallet balance, recent activity. |
| **TransactionHistory** | `TransactionHistory.jsx` | Filterable, sortable table of all API usage logs. Shows token counts, ALGO charges, success/fail status. |
| **PredictionDashboard** | `PredictionDashboard.jsx` | Charts showing historical spend and AI-predicted future usage with top-up recommendations. |
| **CreatorDashboard** | `CreatorDashboard.jsx` | Creator's services, aggregate stats (revenue, calls, tokens served), usage logs. |
| **CreateService** | `CreateService.jsx` | Form to publish a new AI service: title, description, AI provider, model name, API key, pricing (per-1K-tokens rate and minimum charge). |

### 6.3 Components

| Component | File | Description |
|-----------|------|-------------|
| **ContractStats** | `ContractStats.jsx` | Fetches and displays on-chain contract stats (total purchases, ALGO processed). |
| **UserLiveWalletBar** | `UserLiveWalletBar.jsx` | Shows the user's live ALGO balance, refreshed from the Indexer. |
| **ErrorBoundary** | `ErrorBoundary.jsx` | React error boundary that catches render errors and shows a fallback UI. |

### 6.4 Hooks

| Hook | File | Description |
|------|------|-------------|
| **useTokenEstimate** | `useTokenEstimate.js` | Given a text string, `pricePerThousandTokens`, and `minimumChargeAlgo`, computes a live estimate: `{ estimatedAlgo, minApplies, estTokensRounded }`. Uses `(chars/4) × 1.5` for token estimation. |

### 6.5 Context (State Management)

**File:** `frontend/src/context/AuthContext.jsx`

- Stores `token` (JWT string) and `user` object in React state.
- Persists the JWT to `localStorage` under key `sentinal_token`.
- `login(walletAddress, role)` — calls `POST /api/auth/login`, derives user from JWT payload.
- `logout()` — clears token from state and localStorage.
- On page load, attempts to reconstruct user state from stored JWT.

### 6.6 Wallet Integration

**File:** `frontend/src/wallet/pera.js`

Wraps `@perawallet/connect` with:

- **`connectPera()`** — Opens the Pera Wallet connection flow. Returns the connected address.
- **`reconnectPera()`** — Attempts to restore a previous session.
- **`disconnectPera()`** — Disconnects the wallet.
- **`signAndSendPayment({ from, to, amountMicroAlgos, noteStr, algodServer })`** — The core payment function:
  1. Creates an Algod client pointed at the provided server (TestNet).
  2. Fetches suggested params (fees, genesis hash, etc.).
  3. Constructs a `PaymentTransaction` using `algosdk.makePaymentTxnWithSuggestedParamsFromObject()`.
  4. Signs via Pera Wallet (`peraWallet.signTransaction()`).
  5. Submits to the network (`algod.sendRawTransaction()`).
  6. Waits for confirmation (`algosdk.waitForConfirmation()`).
  7. Returns `{ txId }`.
- **`normalizeAccountAddress(raw)`** — Handles various formats Pera may return (string, object with `.address`).
- **`addressesEqual(a, b)`** — Canonical comparison using `algosdk.encodeAddress(decodeAddress(...))`.

Chain ID `416002` = Algorand TestNet.

### 6.7 API Client & Utilities

| File | Purpose |
|------|---------|
| `api/client.js` | Axios instance. Base URL from `VITE_API_URL` env var (empty = same-origin proxy). `setAuthToken(token)` sets the `Authorization: Bearer` header. |
| `utils/apiBase.js` | Resolves the API base URL. |
| `utils/jwt.js` | Decodes JWT payloads client-side (base64 → JSON, no verification). Used to extract `walletAddress`, `role`, `sub` without a server roundtrip. |
| `utils/tokenPricing.js` | `wordsToApproxTokens(words)` — `words × 4/3`. `chargeForTokens()` / `chargeForWords()` — mirrors backend billing logic. |

**Vite Config** (`vite.config.js`):
- React plugin + Node polyfills (Buffer, global, process — needed by `algosdk`).
- Dev proxy: `/api` → `http://localhost:5001` (backend).
- `global` defined as `globalThis` for algosdk browser compatibility.

---

## 7. Smart Contract — Detailed Breakdown

### 7.1 Contract Source (Puya/algopy)

**File:** `contract/sentinel_contract.py`

```python
class SentinelContract(ARC4Contract):
    # Global state: 3 uint64 values, 0 byte slices
    min_payment: UInt64          # Minimum top-up in microAlgos
    total_purchases: UInt64      # Counter of purchase calls
    total_algo_received: UInt64  # Cumulative ALGO received (microAlgos)
```

**Methods:**

| Method | ARC4 Signature | Description |
|--------|---------------|-------------|
| `create_application(min_amount)` | `create_application(uint64)` | Called once during deployment. Sets the minimum payment threshold. |
| `purchase(pay)` | `purchase(pay)` | Called in an **atomic group** that includes a Payment transaction to the contract address. Asserts `pay.receiver == app address` and `pay.amount >= min_payment`. Increments `total_purchases` and `total_algo_received`. |
| `read_stats()` | `read_stats()` | **Read-only.** Returns `(min_payment, total_purchases, total_algo_received)`. |

### 7.2 Deployment Script

**File:** `contract/deploy.py`

1. **Compiles** `sentinel_contract.py` → TEAL using `puyapy`.
2. **Compiles** TEAL → bytecode using the Algod `compile` endpoint.
3. **Creates** an `ApplicationCreateTxn` with the compiled programs and global state schema (3 uint64s).
4. Signs with `DEPLOYER_MNEMONIC` and submits to TestNet.
5. Waits for confirmation and extracts the `application-index` (app ID).
6. Computes the **application address** via `get_application_address(app_id)`.
7. Writes `{ appId, contractAddress }` to `contract/contract_info.json`.

**Environment variables:**
- `DEPLOYER_MNEMONIC` — 25-word Algorand mnemonic with TestNet ALGO for fees.
- `SENTINEL_MIN_MICRO_ALGOS` — Minimum top-up (default 1,000,000 = 1 ALGO).
- `ALGOD_SERVER` — Algod node URL (default: `https://testnet-api.algonode.cloud`).

### 7.3 Compiled Artifacts

| File | Purpose |
|------|---------|
| `SentinelContract.approval.teal` | The main contract logic (approval program). |
| `SentinelContract.clear.teal` | The clear-state program (minimal — always approves). |
| `SentinelContract.arc56.json` | Extended ABI definition with method signatures, state layout, and source maps. |
| `*.puya.map` | Source maps linking TEAL back to Python source lines. |

---

## 8. Core Flows — Step-by-Step

### 8.1 User Login Flow

```
1. User clicks "Connect Wallet" on Home page
2. Pera Wallet opens → user approves connection
3. Frontend receives walletAddress from Pera
4. User selects role: "user" or "creator"
5. Frontend calls POST /api/auth/login { walletAddress, role }
6. Backend:
   a. Validates Algorand address format
   b. Canonicalizes address
   c. Migrates legacy wallet references
   d. Creates or updates User document
   e. Signs a JWT (7-day expiry) with { sub, walletAddress, role }
7. Frontend stores JWT in localStorage, sets Axios auth header
8. User is redirected to role-appropriate dashboard
```

### 8.2 Service Creation Flow (Creator)

```
1. Creator navigates to /creator/new
2. Fills out form:
   - Title, Description
   - AI Provider (Groq/OpenAI/Anthropic/Together)
   - Model Name (e.g., "llama-3.1-70b-versatile")
   - Provider API Key (entered once, never shown again)
   - Price per 1K tokens (ALGO)
   - Minimum charge per call (ALGO)
3. Frontend calls POST /api/services with form data
4. Backend:
   a. Verifies creator role
   b. AES-256-GCM encrypts the provider API key
   c. Creates Service document in MongoDB
   d. Returns service data (without encrypted key)
5. Service now appears on the marketplace for users
```

### 8.3 Pay-Per-Use AI API Call Flow

This is the **primary flow** — a two-step process:

```
STEP 1 — QUOTE:
1. User writes a prompt on the ServiceDetail page
2. Live cost estimate shown via useTokenEstimate hook
3. User clicks "Send" → POST /api/use { messages: [...] }
   (authenticated via X-API-Key header)
4. Backend:
   a. Validates the access token
   b. Decrypts creator's provider API key
   c. Forwards request to AI provider (Groq/OpenAI/etc.)
   d. Receives AI response + token usage
   e. Computes exact charge in ALGO
   f. Caches AI response in memory (60s TTL)
   g. Returns { awaitingPayment: true, paymentRef, chargeAlgo, developerWallet }
5. Frontend displays charge and "Pay" button

STEP 2 — PAY & COMPLETE:
6. User clicks "Pay" → Pera Wallet opens
7. User signs an Algorand payment transaction:
   - From: user wallet
   - To: creator wallet (developerWallet)
   - Amount: chargeAlgo (in microAlgos)
   - Note: paymentRef (UUID)
8. Frontend calls POST /api/use { txId, paymentRef }
9. Backend:
   a. Checks for replay (txId already used)
   b. Retrieves cached session by paymentRef
   c. Polls Algorand Indexer for the transaction
   d. Validates sender, receiver, amount (±1%), note
   e. Creates ApiUsageLog with success: true
   f. Async: submits proof-of-intelligence hash on-chain
   g. Returns { AI response, sentinelReceipt }
10. User sees the AI response on screen
```

### 8.4 Direct Payment & Access Token Flow

An alternative to the metered flow — pay once for an access token:

```
1. User on ServiceDetail clicks "Buy Access"
2. POST /api/payment/create { serviceId }
3. Backend returns { paymentIntentId, receiver, amountMicroAlgos, note }
4. User signs Algorand payment via Pera Wallet
5. POST /api/payment/verify { txId, paymentIntentId }
6. Backend verifies on-chain, creates AccessToken
7. User receives sk-sentinel-<hex> API key
8. User can now call POST /api/use with this key
```

### 8.5 Top-Up (Contract) Flow

```
1. POST /api/wallet/topup/create
2. Backend reads min_payment from on-chain contract
3. Returns { paymentIntentId, receiver: contractAddress, amountMicroAlgos }
4. User signs payment to the contract address via Pera
5. POST /api/wallet/topup/verify { txId, paymentIntentId }
6. Backend verifies on-chain (receiver = contract address, amount ≥ min)
7. TopUpIntent marked "verified"
```

### 8.6 Proof-of-Intelligence Flow

```
After a successful metered AI call:
1. Backend computes SHA-256 of: prompt|response|userWallet|serviceId|timestamp
2. Constructs an Algorand payment:
   - From: PLATFORM_MNEMONIC wallet
   - To: PROOF_LOG_ADDRESS
   - Amount: 0.001 ALGO (1000 microAlgos)
   - Note: "proof of intelligence:<sha256hex>"
3. Signs and submits to TestNet
4. Stores the txId in ApiUsageLog.proofTxId
5. This creates an immutable on-chain record of the AI interaction
```

### 8.7 Burner Wallet Flow

The Burner Wallet is a hot Algorand wallet stored locally (mnemonic in `localStorage`) and optionally synced to the backend encrypted in MongoDB. It allows automatic payments without manual Pera Wallet signing per transaction.

```
1. On first load, frontend checks localStorage for "burner_wallet_mnemonic"
2. If absent, algosdk.generateAccount() creates a new account; mnemonic stored in localStorage
3. POST /api/profile/burner { mnemonic } syncs the encrypted mnemonic to the user's MongoDB profile
4. GET  /api/profile/burner retrieves the mnemonic (decrypted server-side) for other services
5. User funds the burner wallet by sending ALGO to its address from Pera Wallet
6. Automated clients (and future x402 agents) can sign transactions using burner.sk directly — no user prompt
7. On logout or manual reset, the burner wallet can refund remaining ALGO back to Pera via closeRemainderTo
```

## 10. Agent Context JSON

**Endpoint:** `GET /api/services/agent-context` — public, no auth required.

This endpoint returns a **live, machine-readable JSON document** describing every active, configured service on the Sentinel marketplace. It is designed to be pasted directly into any AI assistant (Claude, ChatGPT, Gemini, etc.) to help it recommend the best service for a user's specific use-case.

### Response shape

```json
{
  "sentinel_agent_context": true,
  "version": "1.0",
  "generated_at": "<ISO timestamp — always live>",
  "network": "algorand-testnet",
  "base_url": "http://localhost:5000",
  "description": "...",
  "instructions_for_ai_agent": "Compare services by model, provider, pricing...",
  "total_active_services": 9,
  "services": [
    {
      "id": "<mongodb_id>",
      "name": "Sentinal AI Official Chat",
      "description": "...",
      "badge": "official",
      "ai_provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "pricing": {
        "per_1k_tokens_algo": 0.005,
        "minimum_charge_algo": 0.01,
        "billing_notes": "Pay-per-use via Algorand Testnet..."
      },
      "usage": { "total_calls": 42, "total_revenue_algo": 0.21 },
      "how_to_use": {
        "step_1_generate_key": "POST /api/access/generate ...",
        "step_2_call_api": "POST /api/use ...",
        "step_3_pay": "Send microAlgos on Algorand Testnet...",
        "step_4_claim": "POST /api/use { txId, paymentRef } ..."
      },
      "creator_wallet": "<algorand address>",
      "last_updated": "<ISO timestamp>"
    }
  ]
}
```

**Filtering:** Only services where `isPaused: false` AND `aiProvider` is set AND `encryptedApiKey` exists are included. Results are sorted by `totalUses` descending (most popular first).

**Frontend panel:** The User Dashboard (`/dashboard/home`) includes an **Agent Context JSON** panel with:
- Scrollable JSON preview
- Live status pills (service count, network, generation time)
- **Copy JSON** button (clipboard, with checkmark feedback)
- **Download .json** button (saves `sentinel-agent-context-YYYY-MM-DD.json`)
- Prompt tip: *"Here is the Sentinel marketplace JSON. Which service should I use for [task]?"*

---

## 11. x402 Payment Protocol (Roadmap)

> **Status: Planned — not yet in production. The analysis and integration design is complete.**

The [x402 protocol](https://x402.org) is an open standard that repurposes HTTP `402 Payment Required` to create a universal machine-readable payment challenge for AI agents.

### Flow comparison

| Step | Current Sentinel (custom 2-step) | x402 standard |
|------|----------------------------------|----------------|
| 1 | `POST /api/use` → quote | Client sends normal HTTP request |
| 2 | Frontend pays on-chain manually | Server returns **HTTP 402** + `PAYMENT-REQUIRED` header (Base64 JSON) |
| 3 | `POST /api/use` with `txId` → claim | `@x402/fetch` auto-constructs + signs Algorand txn |
| 4 | AI response returned | Client retries with `X-PAYMENT` header → server verifies → 200 + resource |

### Planned endpoint

`POST /api/x402/use/:serviceId` — a parallel route wrapping existing services with `ExactAvmScheme` middleware from `@x402/avm`. The existing `/api/use` two-step flow remains unchanged.

### Key packages

| Package | Role |
|---------|------|
| `@x402/avm` | Server middleware (`ExactAvmServer`); emits 402 + verifies `X-PAYMENT` |
| `@x402/fetch` | Client wrapper (`wrapFetchWithPayment`); intercepts 402, pays, retries |

### Burner wallet ↔ x402 key format

The `algosdk` burner mnemonic maps to the x402 `secretKeyB64` as:
```js
const account = algosdk.mnemonicToSecretKey(mnemonic);
const secretKeyB64 = Buffer.concat([
  Buffer.from(account.sk.slice(0, 32)),   // Ed25519 seed
  Buffer.from(account.addr.publicKey),    // Public key
]).toString('base64');
const avmSigner = toClientAvmSigner(secretKeyB64);
```

### Pricing note

x402's `ExactAvmScheme` uses a **fixed amount** set at the 402 response time. Sentinel's per-token dynamic pricing is incompatible with a single-round-trip x402 call. The planned x402 endpoint will use `minimumChargeAlgo` as a fixed price per call.

---

## 12. Environment Variables Reference

### Backend `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` / `MONGODB_URI` | ✅ | MongoDB connection string. |
| `JWT_SECRET` | ✅ | Secret for signing JWTs. Must be long and random. |
| `ENCRYPTION_KEY` | ✅ | Key for AES-256-GCM encryption of provider API keys. Exactly 32 characters recommended. |
| `PORT` | ❌ | Server port (default: 5000). |
| `FRONTEND_URL` / `FRONTEND_ORIGIN` | ❌ | CORS origin (default: `http://localhost:5173`). |
| `NODE_ENV` | ❌ | `"development"` to expose error details. |
| `ALGORAND_NODE` / `ALGOD_SERVER` | ❌ | Algorand Algod URL (default: `https://testnet-api.algonode.cloud`). |
| `ALGORAND_INDEXER` / `INDEXER_SERVER` | ❌ | Algorand Indexer URL (default: `https://testnet-idx.algonode.cloud`). |
| `ALGOD_TOKEN` | ❌ | Algod API token (empty for public nodes). |
| `ALGO_APP_ID` | ❌ | Deployed smart contract application ID. |
| `ALGO_CONTRACT_ADDRESS` | ❌ | Smart contract application address. |
| `CONTRACT_INFO_PATH` | ❌ | Path to `contract_info.json` (auto-detected). |
| `GROQ_API_KEY` | ❌ | Platform-level Groq key (not used directly — creators supply their own). |
| `ANTHROPIC_API_KEY` | ❌ | Platform-level Anthropic key (same as above). |
| `PLATFORM_MNEMONIC` | ❌ | 25-word mnemonic for proof-of-intelligence transactions. |
| `PROOF_LOG_ADDRESS` / `PLATFORM_WALLET_ADDRESS` | ❌ | Algorand address for proof logs. |
| `TREASURY_WALLET` | ❌ | Treasury wallet address (informational). |
| `COST_PER_REQUEST` | ❌ | Legacy flat cost field (deprecated, now per-token). |
| `TOPUP_MIN_MICRO_ALGOS` | ❌ | Override minimum top-up amount. |
| `DEPLOYER_MNEMONIC` | ❌ | For contract deployment only. |
| `SENTINEL_MIN_MICRO_ALGOS` | ❌ | For contract deployment only. |

### Frontend `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ❌ | Backend API URL. Leave empty to use Vite dev proxy. |

---

## 10. API Reference (All Endpoints)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/health` | ❌ | — | Health check |
| `GET` | `/api/public/network` | ❌ | — | Returns Algod server URL |
| `POST` | `/api/auth/login` | ❌ | — | Wallet-based JWT login |
| `GET` | `/api/services` | ❌ | — | List all services |
| `GET` | `/api/services/agent-context` | ❌ | — | Live AI-readable service catalog JSON (new) |
| `GET` | `/api/services/:id` | ❌ | — | Get single service |
| `POST` | `/api/services` | ✅ | `creator` | Create service |
| `PATCH` | `/api/services/:id` | ✅ | `creator` | Update service |
| `DELETE` | `/api/services/:id` | ✅ | `creator` | Delete service |
| `POST` | `/api/payment/create` | ✅ | `user` | Create payment intent |
| `POST` | `/api/payment/verify` | ✅ | `user` | Verify on-chain payment |
| `POST` | `/api/access/generate` | ✅ | `user` | Generate/retrieve API key |
| `GET` | `/api/access/:serviceId` | ✅ | any | List access tokens |
| `POST` | `/api/use` | 🔑 | — | Metered AI call — quote (no txId) or claim (with txId) |
| `GET` | `/api/creator/services` | ✅ | `creator` | Creator's services |
| `GET` | `/api/creator/stats` | ✅ | `creator` | Aggregate creator stats |
| `GET` | `/api/creator/usage` | ✅ | `creator` | Creator usage logs |
| `GET` | `/api/user/algo-balance` | ✅ | `user` | Live ALGO balance |
| `GET` | `/api/user/proxy-keys` | ✅ | `user` | User's API keys |
| `GET` | `/api/user/transactions` | ✅ | `user` | Transaction history |
| `GET` | `/api/user/usage` | ✅ | `user` | Simple usage logs |
| `POST` | `/api/wallet/topup/create` | ✅ | `user` | Create top-up intent |
| `POST` | `/api/wallet/topup/verify` | ✅ | `user` | Verify top-up payment |
| `GET` | `/api/contract/stats` | ❌ | — | On-chain contract stats |
| `GET` | `/api/prediction/usage` | ❌ | — | Spending prediction |
| `GET` | `/api/prediction/history` | ❌ | — | Raw monthly history |
| `GET` | `/api/profile/burner` | ✅ | any | Retrieve encrypted burner mnemonic (new) |
| `POST` | `/api/profile/burner` | ✅ | any | Sync burner mnemonic to profile (new) |
| `GET` | `/api/profile/summary` | ✅ | any | Profile summary stats (new) |

**Chat Backend endpoints (port 4000):**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | ❌ | Health check |
| `GET` | `/conversations` | ✅ JWT | List conversations |
| `GET` | `/messages/:id` | ✅ JWT | Messages for a conversation |
| `GET` | `/user-info` | ✅ JWT | Burner balance + address |
| `POST` | `/chat` | ✅ JWT | Auto-pay AI chat message |

**Legend:** ✅ = JWT required, 🔑 = API key (`Authorization: Bearer sk-sentinel-xxx`), ❌ = No auth

---

## 14. Security Mechanisms

| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| **API Key Encryption** | AES-256-GCM with SHA-256 derived key | Creator API keys are never stored in plaintext. Only decrypted in-memory at call time. |
| **JWT Authentication** | `jsonwebtoken` with `JWT_SECRET` | Stateless auth with 7-day expiry. Carries wallet address and role. |
| **Replay Attack Prevention** | Partial unique index on `paymentTxId` (when `success: true`) | Same Algorand transaction cannot be used twice for different API calls. |
| **Payment Note Verification** | UUID embedded in transaction note | Ensures the on-chain payment corresponds to the specific quote/intent. |
| **Sender/Receiver Validation** | `normalizeAlgoAddress()` comparison | Ensures the transaction sender is the authenticated user and receiver is the correct creator. |
| **Amount Tolerance** | ±1% `microAlgosWithinTolerance()` | Handles minor rounding differences between quote and actual payment. |
| **Rate Limiting** | `express-rate-limit` (30 req/min on `/api/use`) | Prevents abuse of the AI proxy. |
| **Helmet** | Security headers (CSP, XSS, etc.) | Standard Express security hardening. |
| **Input Validation** | `express-validator` on all routes | Sanitizes and validates all request parameters. |
| **CORS** | Restricted to `FRONTEND_URL` | Prevents unauthorized cross-origin API access. |
| **60-Second Payment TTL** | In-memory cache timeout | Prevents indefinite holding of AI responses without payment. |
| **Canonical Wallet Addresses** | `encodeAddress(decodeAddress(...))` | Prevents duplicate accounts from address format variations. |

---

## 15. Prediction & Analytics Engine

**File:** `backend/src/routes/prediction.js`

The prediction system provides AI-based usage forecasting. It aggregates transaction history and applies time-series models.

### Models Available

| Model | Algorithm | Best For |
|-------|-----------|----------|
| `linear` (default) | Ordinary Least Squares regression | Clear growth/decline trends |
| `weighted` | Weighted Moving Average | Volatile usage patterns (recent data weighted more) |

### How It Works

1. **Aggregation:** Groups verified transactions by calendar month using MongoDB's `$group` aggregation.
2. **Linear Regression:** Fits `y = slope × x + intercept` to monthly totals. Reports R² confidence.
3. **Weighted Moving Average:** Assigns increasing weights to recent months. Adds a growth factor from the last two periods.
4. **Forecast:** Generates `forecastMonths` (default 3) future predictions with ALGO, USD, and INR values.
5. **Recommendation:** Suggests top-up amount for the next 30 days with a 15% safety buffer.
6. **Trend Analysis:** Classifies trend as "increasing" (>2%), "decreasing" (<-2%), or "stable".

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `wallet` | — | Filter by specific wallet (omit for platform-wide) |
| `historyMonths` | 6 | Months of training data (2–24) |
| `forecastMonths` | 3 | Months to predict (1–12) |
| `model` | `linear` | `"linear"` or `"weighted"` |
| `algoCostUSD` | 0.15 | ALGO→USD conversion rate |
| `usdToInr` | 84 | USD→INR conversion rate |

---

*Last updated: May 2026. Reflects Pera wallet auth, burner wallet sync, Agent Context JSON endpoint, and x402 roadmap.*
