# SentinelAI: Production Setup & Operations Guide

Once frontend and backend are deployed, configure environment variables and verify core flows.

## Backend environment

| Variable | Description | Example |
|---|---|---|
| `MONGO_URI` | MongoDB connection | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | random string |
| `RPC_URL` | Base Sepolia RPC | `https://sepolia.base.org` |
| `CHAIN_ID` | Network ID | `84532` |
| `TREASURY_WALLET_ADDRESS` | Platform fee receiver | `0x...` |
| `RECEIVER_WALLET` | Gateway deposit receiver | `0x...` |
| `CONTRACT_ADDRESS` | SentinelPayment contract | from `contract_info.json` |
| `ETH_USD_RATE` | ETH price for display | `3200` |
| `ENCRYPTION_KEY` | 32-char AES key | required |

## Platform lifecycle

### Creator onboarding

1. Register / sign in with MetaMask (`POST /api/auth/challenge` + `login`)
2. Link wallet on profile page
3. Publish a service with price per 1k tokens and minimum charge in ETH

### Consumer usage

1. Connect MetaMask on Base Sepolia
2. Purchase API access or use x402 keyless flow
3. Each call deducts ETH; receipts link to BaseScan

### Studio subscriptions

1. User selects plan on `/studio/plan`
2. Pays ETH to treasury via MetaMask
3. Credits reset monthly; overage billed via x402 in ETH

## Verification checklist

- [ ] MetaMask connects on chain 84532
- [ ] Contract deployed and `CONTRACT_ADDRESS` set
- [ ] x402 flow returns 402 then 200 with valid tx on BaseScan
- [ ] Studio overage modal shows ETH amounts

## Monitoring

- MongoDB: usage logs, subscriptions
- BaseScan: on-chain payment verification
- Google Cloud / Gemini: Studio COGS (`GET /api/studio/admin/cogs-report`)
