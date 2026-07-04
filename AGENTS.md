# SentinelAI — Fhenix/CoFHE Edition (Base Sepolia)

> Agent guide for AI-assisted development on this codebase.
> Privacy-preserving AI API marketplace on Base Sepolia using Fhenix FHE.

---

## Architecture at a glance

```
frontend/          React + Vite + TailwindCSS
  wallet/
    metamask.js        EVM wallet (MetaMask)
    sessionKey.js      Local encrypted EVM key for headless x402 payments
  context/
    MetaMaskLoginContext.jsx   Login/registration flow
    AuthContext.jsx            JWT session management
  api/
    proxyX402Use.js    x402 AI call with session key ETH payment
    studioOverage.js   MetaMask overage payment
  utils/
    explorer.js        BaseScan URLs (sepolia.basescan.org)

backend/           Node.js + Express + MongoDB
  src/services/
    evmService.js          Base Sepolia RPC, tx receipt, address utils
    fhenixX402Middleware.js  HTTP 402 challenge/verify on Base Sepolia
    billing.js             computeChargeEth(), weiWithinTolerance()
    platformStats.js       Reads ETH balances, BaseScan URLs
  src/routes/
    payment.js    2-step marketplace ETH payment + API key issuance
    wallet.js     SentinelPayment contract top-up
    x402.js       Keyless AI call via x402 on Base Sepolia
    auth.js       MetaMask personal_sign challenge auth (ethers.verifyMessage)

contract/          Hardhat + Solidity (FHE)
  contracts/
    SentinelPayment.sol    FHE-encrypted balances via @fhenixprotocol/cofhe-contracts
  scripts/
    deploy.js              Deploys to Base Sepolia, writes contract_info.json
```

---

## Network

| Parameter | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | 84532 |
| RPC | `https://sepolia.base.org` |
| Explorer | `https://sepolia.basescan.org` |
| Native Token | ETH (Base Sepolia faucet: faucet.base.org) |
| FHE Library | `@fhenixprotocol/cofhe-contracts` — `FHE.sol` |

---

## Smart Contract (FHE)

`SentinelPayment.sol` stores user balances as `euint64` (FHE-encrypted) on Base Sepolia.

```solidity
// Deposit ETH → encrypted balance
function deposit() external payable;

// Deduct per-call charge (operator only, encrypted amount)
function deductForCall(address user, inEuint64 calldata encAmount, address service) external onlyOwner;

// Sealed balance — user unseals with @cofhe/sdk
function sealedBalance() external view returns (euint64);
```

**Deploy:**
```bash
cd contract
cp .env.example .env        # fill DEPLOYER_PRIVATE_KEY + RPC_URL
npm install
npm run deploy              # writes contract_info.json
```

Get testnet ETH: https://faucet.base.org

---

## Backend

### Environment variables

Copy `backend/.env.example` → `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `RPC_URL` | Base Sepolia RPC (default: `https://sepolia.base.org`) |
| `CHAIN_ID` | `84532` |
| `TREASURY_WALLET_ADDRESS` | EVM `0x...` address receiving marketplace fees |
| `CONTRACT_ADDRESS` | SentinelPayment contract address (from `contract_info.json`) |
| `ETH_USD_RATE` | ETH price in USD for display conversion |
| `ENCRYPTION_KEY` | 32-char AES-256 key for provider API key encryption |

### Key service files

**`evmService.js`** — Base Sepolia RPC wrapper:
```js
import { getReceiptWithRetry, normalizeEvmAddress, explorerTxUrl } from "./evmService.js";
```

**`fhenixX402Middleware.js`** — x402 payment challenge/verify:
```js
import { buildPaymentRequirements, send402Response, verifyX402Payment } from "./fhenixX402Middleware.js";
```

**`billing.js`** — charge computation:
```js
import { computeChargeEth, weiWithinTolerance } from "./billing.js";
```

### Auth flow (MetaMask)

1. Client calls `POST /api/auth/challenge` → gets `{ nonce, message }`
2. Client calls `window.ethereum.request({ method: "personal_sign", params: [message, address] })`
3. Client calls `POST /api/auth/login` with `{ walletAddress, nonce, signature }`
4. Server calls `ethers.verifyMessage(message, signature)` to recover signer

### x402 payment flow

```
Client → POST /api/use (no payment)
       ← 402 + { payTo, amountWei, network: "eip155:84532" }
Client → sends ETH to payTo
Client → POST /api/use + X-Payment: base64({txHash, network, amount, payTo})
Server → verifyX402Payment() checks receipt on Base Sepolia
       ← 200 + AI response + { sentinelReceipt: { paymentTxHash, explorerUrl } }
```

---

## Frontend

### Wallet connection (MetaMask)

```js
import { connectMetaMask, signMessage, sendEthPayment } from "./wallet/metamask.js";

const address = await connectMetaMask();          // prompts MetaMask, switches to Base Sepolia
const signature = await signMessage(message, address); // personal_sign for auth
const { txHash } = await sendEthPayment({ from, to, amountWei }); // ETH transfer
```

### Session key (headless payments)

```js
import { ensureSessionKey, getSessionKeyWallet, sendSessionPayment } from "./wallet/sessionKey.js";

await ensureSessionKey(userId, jwtToken);   // generates/restores local EVM key
const { address } = getSessionKeyWallet();  // use for x402 auto-payments
```

### Explorer links (BaseScan)

```js
import { getTxUrl, getAddressUrl } from "./utils/explorer.js";

getTxUrl("0xabc...")     // https://sepolia.basescan.org/tx/0xabc...
getAddressUrl("0xdef...") // https://sepolia.basescan.org/address/0xdef...
```

---

## Development workflow

### Run locally

```bash
# Backend
cd backend
cp .env.example .env    # fill variables
npm install
npm run dev             # http://localhost:5001

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev             # http://localhost:5173 (proxies /api to backend)
```

### Deploy contract (one-time)

```bash
cd contract
npm install
npm run deploy           # needs DEPLOYER_PRIVATE_KEY + RPC_URL in .env
# Then set CONTRACT_ADDRESS in backend/.env from the output
```

### MetaMask testnet setup

1. Open MetaMask → Add Network → Base Sepolia:
   - RPC: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency: `ETH`
   - Explorer: `https://sepolia.basescan.org`
2. Get testnet ETH: https://faucet.base.org

---

## FHE-specific notes

- User balances in `SentinelPayment.sol` are stored as `euint64` — never readable without a permit.
- Deductions via `deductForCall()` take encrypted amounts (submitted by operator using `@cofhe/sdk` server-side).
- Frontend can read sealed balance using `cofhejs.unseal(result, FheTypes.Uint64)` with a user permit.
- `@fhenixprotocol/cofhe-contracts` provides `FHE.sol` with `euint64`, `FHE.add`, `FHE.sub`, `FHE.allowSender`, `FHE.allow`.

See [CoFHE docs](https://cofhe-docs.fhenix.zone/) and npm packages `@cofhe/sdk`, `@fhenixprotocol/cofhe-contracts`.
