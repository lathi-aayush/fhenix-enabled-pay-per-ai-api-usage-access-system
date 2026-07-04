# Sentinel AI Studio — Revenue Model (Base Sepolia / ETH)

**Payment rail:** ETH subscriptions on Base Sepolia + optional pay-per-run overage via x402

## Exchange rates

Set in `backend/.env` and refresh weekly:

```
ETH_USD_RATE=3200
INR_USD_RATE=84.50
STUDIO_OVERAGE_LITE_ETH=0.0002
STUDIO_OVERAGE_BLOG_ETH=0.0003
STUDIO_OVERAGE_CREATIVE_ETH=0.001
STUDIO_OVERAGE_AGENTIC_MED_ETH=0.002
STUDIO_OVERAGE_AGENTIC_FULL_ETH=0.005
```

## Plan tiers

| Tier | Credits/mo | Notes |
|---|---|---|
| free | 15 | Limited features |
| creator | 120 | Blog + prompt tools |
| pro | 400 | Video + full publish |
| enterprise | 1500 | White-label |

## Overage (when credits exhausted)

Charged in ETH via x402 when a run exceeds the credit pool. Rates configured in `backend/src/constants/studioPlans.js` (`OVERAGE_PRICES`).

## Implementation files

| Concern | File |
|---|---|
| Backend pricing | `backend/src/constants/studioPlans.js` |
| Frontend pricing display | `frontend/src/constants/studioPlans.js` |
| Plan page UI | `frontend/src/pages/studio/StudioPlan.jsx` |
| Overage payment | `frontend/src/api/studioOverage.js` |

## Marketplace vs Studio

- **Marketplace APIs:** P2P ETH per call to creator wallet (x402 or 2-step payment)
- **Studio:** Platform subscription credits + ETH overage to treasury

Review monthly against Google Cloud invoices and ETH/INR spot rates.
