# Gateway v2 (Base Sepolia)

Gateway v2 adds prepaid API access with Redis-backed billing alongside the legacy marketplace.

| Layer | Role |
|---|---|
| Base Sepolia | On-chain deposits and developer payouts |
| Redis | Prepaid balance + metering |
| MongoDB | API catalog, subscriptions, usage logs |

Legacy marketplace (`/api/use`, x402, direct ETH to creator) remains active in parallel.

## Key env vars

```
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
ETH_USD=3200
RECEIVER_WALLET=0x...
TREASURY_WALLET_ADDRESS=0x...
GATEWAY_ADMIN_WALLETS=0x...,0x...
REDIS_URL=redis://localhost:6379
```

## Consumer flow

1. Connect MetaMask on Base Sepolia
2. Deposit ETH to treasury / gateway vault
3. Subscribe to an API slug
4. Call `POST /proxy/:slug` — balance debited per request

## Developer flow

1. Publish API with gateway pricing
2. Track earnings in Gateway Developer dashboard
3. Request payout (ETH to registered wallet)

See `backend/src/routes/gateway.js` and `frontend/src/pages/GatewayDeveloper.jsx`.
