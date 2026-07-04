import {
  OVERAGE_PRICES,
  RUN_TYPE_LABELS,
  weiToEth,
  weiToInr,
  weiToUsd,
} from "../constants/studioPlans.js";
import {
  buildPaymentRequirements,
  send402Response,
  decodeXPaymentHeader,
  verifyX402Payment,
} from "../services/fhenixX402Middleware.js";
import { logStudioOverage, isOverageTxReplay } from "../services/studioCredits.js";

function getSentinelWallet() {
  return (
    process.env.TREASURY_WALLET_ADDRESS?.trim() ||
    process.env.RECEIVER_WALLET?.trim() ||
    ""
  );
}

/**
 * Build x402 payment middleware for a fixed overage tier.
 * @param {keyof typeof OVERAGE_PRICES} overageTier
 */
export function createX402Gate(overageTier) {
  const amountWei = OVERAGE_PRICES[overageTier];
  if (!amountWei) {
    throw new Error(`Unknown overage tier: ${overageTier}`);
  }

  return async function x402OverageGate(req, res, next) {
    const payTo = getSentinelWallet();
    if (!payTo) {
      return res.status(500).json({ error: "TREASURY_WALLET_ADDRESS / RECEIVER_WALLET not configured" });
    }

    const runType = req.x402RunType || req.studioRunType || "prompt_single";
    const xPayment =
      req.headers["x-payment"] || req.headers["X-Payment"] || req.body?.xPayment;

    if (xPayment) {
      const decoded = decodeXPaymentHeader(xPayment);
      if (!decoded?.txHash) {
        return res.status(400).json({ error: "Invalid X-Payment header" });
      }

      const verified = await verifyX402Payment({
        xPaymentHeader: typeof xPayment === "string" ? xPayment : undefined,
        expectedReceiver: payTo,
        expectedWei: amountWei,
        resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        description: `Sentinel Studio overage — ${overageTier}`,
      });

      if (!verified.valid) {
        return res.status(402).json({
          error: verified.error || "Payment verification failed",
          studioOverage: buildOveragePayload(runType, overageTier, amountWei),
        });
      }

      if (await isOverageTxReplay(req.user.userId, verified.txHash)) {
        return res.status(409).json({
          error: "Replay attack detected: transaction already used for Studio overage",
        });
      }

      try {
        await logStudioOverage(req.user.userId, {
          runType,
          ethAmount: weiToEth(amountWei),
          txId: verified.txHash,
        });
      } catch (e) {
        if (e.status === 409) {
          return res.status(409).json({ error: e.message });
        }
        throw e;
      }

      req.overagePaid = true;
      req.overageTxId = verified.txHash;
      req.x402Required = false;
      return next();
    }

    const requirements = buildPaymentRequirements({
      payTo,
      amountWei,
      resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      description: `Sentinel Studio overage — ${overageTier}`,
    });

    const body = {
      x402Version: 1,
      error: "Payment Required",
      accepts: requirements.paymentRequirements,
      studioOverage: buildOveragePayload(runType, overageTier, amountWei),
      creditsRemaining: req.creditsRemaining ?? 0,
      creditCost: req.studioCreditCost ?? null,
      creditPool: req.studioCreditPool ?? null,
      hint: "Studio Credits exhausted. Pay the overage in ETH via MetaMask, or upgrade your plan for a larger monthly pool.",
    };

    return res
      .status(402)
      .set("Payment-Required", Buffer.from(JSON.stringify(requirements)).toString("base64"))
      .json(body);
  };
}

function buildOveragePayload(runType, overageTier, amountWei) {
  return {
    runType,
    runTypeLabel: RUN_TYPE_LABELS[runType] || runType,
    overageTier,
    amountWei: String(amountWei),
    amountEth: weiToEth(amountWei),
    amountInr: Math.round(weiToInr(amountWei)),
    amountUsd: Number(weiToUsd(amountWei).toFixed(6)),
    network: "Sepolia",
    chainId: 11155111,
  };
}

/** Only invoke x402 when credits are exhausted. */
export async function conditionalX402Gate(req, res, next) {
  if (!req.x402Required) {
    return next();
  }
  const tier = req.x402OverageTier || "lite";
  return createX402Gate(tier)(req, res, next);
}

export { getSentinelWallet };
