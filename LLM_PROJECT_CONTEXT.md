# SentinelAI: Complete Project Context & Developer Reference

This document serves as a comprehensive, self-contained reference for **SentinelAI** (a pay-per-use AI API marketplace built on the Algorand TestNet blockchain). Paste or upload this file into any AI assistant (like Claude, ChatGPT, or Gemini) to provide complete context of the codebase, business model, database schema, API surface, and core operational flows.

---

## 1. Executive Summary & Business Model

SentinelAI is a decentralized marketplace that enables developers and users to buy and sell AI model API access without subscriptions or vendor lock-in.

* **Creators (Supply Side):** Publish AI services wrapping models from Groq, OpenAI, Anthropic, or Together AI. They set pricing (ALGO per 1,000 tokens) and a minimum charge (ALGO) per call. Creator API keys are stored AES-256-GCM encrypted and only decrypted server-side at call time. All payments flow peer-to-peer (P2P) directly from the user's wallet to the creator's wallet.
* **Users (Demand Side):** Browse the marketplace, fund a **Burner Wallet** (hot wallet stored locally and synced encrypted to their profile) to automatically sign payments, or pay manually per call using **Pera Wallet**.
* **Platform (Sentinel):** Charges a 0.001 ALGO proof-of-intelligence fee per call (sent to a platform log address with a hash of the interaction) and monetizes through **Studio** subscription tiers (paid in ALGO). An optional Algorand smart contract (`SentinelContract`) tracks aggregate transaction volume.

---

## 2. Directory Layout & Repository Structure

```
pay-per-usage-ai-api-access-system-using-algorand/
├── backend/                           # Express.js API server
│   ├── src/
│   │   ├── server.js                  # Express entry point
│   │   ├── config/
│   │   │   ├── db.js                  # MongoDB setup + migrations
│   │   │   └── contractConfig.js      # App ID configuration
│   │   ├── middleware/
│   │   │   └── auth.js                # JWT & role-based middleware
│   │   ├── models/
│   │   │   ├── User.js                # User & role schema
│   │   │   ├── Service.js             # Encrypted provider keys & prices
│   │   │   ├── Transaction.js         # P2P Payment Intents
│   │   │   ├── AccessToken.js         # API Keys (sk-sentinel-...)
│   │   │   ├── ApiUsageLog.js         # Detailed token & cost audit trail
│   │   │   └── TopUpIntent.js         # Contract interaction intents
│   │   ├── routes/                    # Auth, prediction, payment, usage routes
│   │   ├── services/
│   │   │   ├── aiProxy.js             # Groq, OpenAI, Together, Anthropic proxy
│   │   │   ├── algorandService.js     # Indexer, balance, tx verify utils
│   │   │   ├── billing.js             # Token estimation & cost math
│   │   │   ├── pendingUseCache.js     # 60s TTL quote cache for P2P pay
│   │   │   └── proofOfIntelligence.js # Asynchronous on-chain attestation
│   │   └── utils/
│   │       ├── encrypt.js             # AES key derivation & crypt
│   │       └── userWallet.js          # Wallet address canonicalizer
├── frontend/                          # Vite + React 18 + Tailwind SPA
│   ├── vite.config.js                 # Dev server proxy & Node polyfills
│   └── src/
│       ├── main.jsx                   # QueryClient, Router, Auth wrapper
│       ├── App.jsx                    # Routing table & role guards
│       ├── wallet/
│       │   └── pera.js                # PeraWallet connection & signer
│       ├── hooks/
│       │   └── useTokenEstimate.js    # Cost estimation from prompt characters
│       └── pages/                     # Marketplace & Creator dashboards
├── contract/                          # Algorand smart contract
│   ├── sentinel_contract.py           # ARC-4 Puya/algopy python code
│   └── deploy.py                      # Build, compile & deploy script
└── chatbot/                           # Chatbot showcase
    ├── chat-backend/                  # Express (port 4000), stores chat history
    └── chat-front/                    # Vite + React (port 5555) chat client
```

---

## 3. Database Schema (Mongoose Models)

### User (`models/User.js`)
* `walletAddress` (String, Unique, Required): Canonicalized Algorand wallet address.
* `role` (String, Required): `"user"` or `"creator"`.
* `createdAt` (Date): Auto timestamp.

### Service (`models/Service.js`)
* `title` (String, Required): Name of the service.
* `description` (String): Details of the wrapper service.
* `pricePerThousandTokens` (Number, Required): ALGO rate per 1,000 tokens (combined input/output).
* `minimumChargeAlgo` (Number, Required): The base fee floor per request (e.g., 0.001 ALGO).
* `creatorWallet` (String, Required, Indexed): Wallet receiving payments.
* `totalUses` (Number, Default 0): Request counter.
* `totalRevenue` (Number, Default 0): Total ALGO earned.
* `aiProvider` (String, Required): `"groq"`, `"openai"`, `"anthropic"`, or `"together"`.
* `modelName` (String, Required): Underlying model (e.g., `llama-3.3-70b-versatile`).
* `encryptedApiKey` (String, Required): AES-256-GCM encrypted developer API key.
* `isPaused` (Boolean, Default false): Pause/unpause.

### Transaction (`models/Transaction.js`)
* `userWallet` (String, Required): Payer address.
* `serviceId` (ObjectId, Ref: Service, Required): Targeted service.
* `amount` (Number, Required): MicroAlgos transaction value.
* `txId` (String, Unique): Algorand TX hash.
* `status` (String, Default `"pending"`): `"pending"`, `"verified"`, or `"failed"`.
* `paymentIntentId` (String, Unique, Required): UUID note payload.

### AccessToken (`models/AccessToken.js`)
* `userWallet` (String, Required): Wallet that purchased the access.
* `serviceId` (ObjectId, Ref: Service, Required): Target service.
* `key` (String, Required, Unique): `sk-sentinel-<hex>` token.
* `isUsed` (Boolean, Default false): Flag used to check activation.

### ApiUsageLog (`models/ApiUsageLog.js`)
* `userWallet` (String, Required): Caller address.
* `serviceId` (ObjectId, Ref: Service, Required): Service ID.
* `accessTokenId` (ObjectId, Ref: AccessToken): Token used.
* `developerWallet` (String, Required): Payer receiver address.
* `amountAlgo` (Number): ALGO charge computed.
* `aiProvider` / `modelName` (String): Metadata snapshots.
* `paymentTxId` (String, Partial Unique): TestNet TX ID. Prevent replay attacks.
* `paymentRef` (String): UUID matching quote to verification.
* `success` (Boolean): Call success indicator.
* `promptTokens` / `completionTokens` / `totalTokens` (Number): Upstream token counts.
* `chargeAlgo` (Number): Computed final fee.
* `pricePerThousandTokens` (Number): Price snapshot.
* `proofTxId` (String): On-chain proof-of-intelligence TX ID.

---

## 4. Key Architectural Flows

### 1. Pay-Per-Use AI call Flow (Metered)
```
[User Browser]             [Main Backend]             [AI Provider]           [Indexer]
      │                           │                         │                     │
      │ 1. POST /api/use          │                         │                     │
      │    (Prompt, no txId)      │                         │                     │
      ├──────────────────────────►│                         │                     │
      │                           │ 2. Decrypt Creator Key  │                     │
      │                           │ 3. Forward request      │                     │
      │                           ├────────────────────────►│                     │
      │                           │ 4. Return response      │                     │
      │                           │◄────────────────────────┤                     │
      │                           │ 5. Parse token count    │                     │
      │                           │ 6. Cache response (60s) │                     │
      │ 7. Return paymentRef      │                         │                     │
      │    and quote charge       │                         │                     │
      │◄──────────────────────────┤                         │                     │
      │                           │                         │                     │
      │ 8. Sign + send P2P        │                         │                     │
      │    transaction with       │                         │                     │
      │    paymentRef note to     │                         │                     │
      │    creator wallet via     │                         │                     │
      │    Pera / Burner Wallet   │                         │                     │
      ├───────────────────────────┼─────────────────────────┼────────────────────►│
      │                           │                         │                     │
      │ 9. POST /api/use          │                         │                     │
      │    {txId, paymentRef}     │                         │                     │
      ├──────────────────────────►│                         │                     │
      │                           │ 10. Lookup & Verify     │                     │
      │                           │     transaction details │                     │
      │                           ├─────────────────────────┼────────────────────►│
      │                           │◄────────────────────────┼─────────────────────┤
      │                           │ 11. Store ApiUsageLog   │                     │
      │                           │ 12. Submit proof (async)│                     │
      │ 13. Return AI Response    │                         │                     │
      │◄──────────────────────────┤                         │                     │
```

### 2. Burner Wallet Flow (Automatic Signatures)
1. On startup, frontend checks local storage for a burner key. If missing, it generates a keypair (`algosdk.generateAccount()`) and stores the mnemonic locally.
2. The mnemonic is sent via `POST /api/profile/burner` to the main backend where it is **AES-256-GCM encrypted** using `ENCRYPTION_KEY` and saved in MongoDB.
3. The chatbot (or other programmatic clients) queries `GET /api/profile/burner`, decrypts it, and uses the private key to sign the P2P transaction note programmatically, eliminating wallet prompt popups.

### 3. Proof-of-Intelligence Flow
After a successful transaction verification:
1. The backend hashes: `prompt | response | userWallet | serviceId | timestamp` using SHA-256.
2. The platform wallet (`PLATFORM_MNEMONIC`) executes a 0.001 ALGO payment on-chain to `PROOF_LOG_ADDRESS` with the note: `proof of intelligence:<sha256-hash>`.

---

## 5. Algorand Smart Contract (`SentinelContract`)

Written in Python with **Puya/algopy**, compiling to TEAL. Exposes state tracking for platform metrics.

```python
class SentinelContract(ARC4Contract):
    min_payment: UInt64          # Minimum top-up in microAlgos
    total_purchases: UInt64      # Counter of purchase calls
    total_algo_received: UInt64  # Cumulative ALGO received (microAlgos)

    @arc4.abimethod(allow_actions=["NoOp"], create="require")
    def create_application(self, min_amount: UInt64) -> None:
        self.min_payment = min_amount
        self.total_purchases = UInt64(0)
        self.total_algo_received = UInt64(0)

    @arc4.abimethod
    def purchase(self, pay: gtxn.PaymentTransaction) -> None:
        assert pay.receiver == Txn.application_address
        assert pay.amount >= self.min_payment
        self.total_purchases += 1
        self.total_algo_received += pay.amount

    @arc4.abimethod(readonly=True)
    def read_stats(self) -> tuple[UInt64, UInt64, UInt64]:
        return (self.min_payment, self.total_purchases, self.total_algo_received)
```

---

## 6. Endpoints Reference

### Main Backend (`:5000`)
* **Auth:**
  * `POST /api/auth/login`: Wallet-based JWT login. Returns `{ token, user }`.
* **Services:**
  * `GET /api/services`: List active services.
  * `GET /api/services/agent-context`: Live AI-agent-readable JSON service registry.
  * `POST /api/services`: (Creator) Publish service (encrypts key).
  * `PATCH /api/services/:id`: (Creator) Edit service.
* **Metered AI Use:**
  * `POST /api/use`: Quote/Complete double-step API entrypoint.
* **Payment Intents:**
  * `POST /api/payment/create`: Get payment instructions.
  * `POST /api/payment/verify`: Confirm on-chain receipt and issue an AccessToken.
* **Token/Keys:**
  * `POST /api/access/generate`: Issue/Retrieve key for user.
* **Prediction:**
  * `GET /api/prediction/usage`: Spend forecasts (Ordinary Least Squares or Weighted Moving Average).
* **Burner Profile:**
  * `GET /api/profile/burner`: Fetch decrypted burner wallet mnemonic.
  * `POST /api/profile/burner`: Encrypt and save burner mnemonic.

### Chatbot Backend (`:4000`)
* `GET /health`: Server health check.
* `GET /conversations`: Retrieve conversation list.
* `GET /messages/:conversationId`: Fetch messages.
* `GET /user-info`: Get current burner balance.
* `POST /chat`: Orchestrate quote $\rightarrow$ burner payment $\rightarrow$ claim response automatically.

---

## 7. Security Configurations
* **Replay Attack Defense:** The `ApiUsageLog` database index enforces a partial unique constraint on `paymentTxId`. An Algorand transaction ID cannot be processed twice for successful requests.
* **Key Encryption:** `backend/src/utils/encrypt.js` derives a 32-byte AES key using SHA-256 of `ENCRYPTION_KEY`, performing AES-256-GCM encryption on provider keys.
* **Address Canonicalization:** Prevents duplication due to alternate uppercase/lowercase or spacing variants by executing a roundtrip: `encodeAddress(decodeAddress(addr))` inside the login/utility scripts.
* **Payment Tolerance:** A ±1% validation window is applied to the difference between backend quote charges and verified on-chain transactions to handle minor division/rounding differences.
* **Timeout Guards:** Cached AI outputs expire in 60 seconds if payment verification isn't finalized to prevent memory leakages.

---

## 8. Prediction Analytics Logic
Located in `backend/src/routes/prediction.js`. Supported modes:
1. **Linear Regression (`linear`):** Ordinary Least Squares (OLS) model projecting `y = slope * x + intercept`.
2. **Weighted Moving Average (`weighted`):** Applies higher weights to recent monthly volumes (e.g. `Weight = Period_Index / Sum_of_Periods`) combined with a last-period growth rate factor. Recommended top-up aggregates 30-day forecast totals with a 15% safety buffer.
