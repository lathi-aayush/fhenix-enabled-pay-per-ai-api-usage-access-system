/**
 * x402 keyless AI endpoint — pay-per-call without an API key.
 *
 * POST /api/x402/use/:serviceId
 *
 * Tries FHE encrypted prepaid balance first, then HTTP 402 x402 ETH payment.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Service } from "../models/Service.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";
import {
  buildPaymentRequirements,
  send402Response,
  verifyX402Payment,
} from "../services/fhenixX402Middleware.js";
import { forwardChatCompletion } from "../services/aiProxy.js";
import { ethToWei, explorerTxUrl, isValidEvmAddress } from "../services/evmService.js";
import { computeChargeEth } from "../services/billing.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { tryFheAiPayment, buildAiBodyFromRequest } from "../services/fhePaymentFlow.js";
import { getNetworkConfig } from "../config/chainConfig.js";

const router = Router();

router.post("/use/:serviceId", requireAuth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service || !service.x402Enabled) {
      return res.status(404).json({ error: "Service not found or x402 not enabled" });
    }

    const creatorWallet = String(service.creatorWallet || "").trim();
    if (!isValidEvmAddress(creatorWallet)) {
      return res.status(500).json({ error: "Service has an invalid creator wallet address" });
    }

    const minChargeEth = Number(service.minimumChargeEth);
    if (!Number.isFinite(minChargeEth) || minChargeEth <= 0) {
      return res.status(500).json({ error: "Service has an invalid minimum charge" });
    }

    const amountWei = ethToWei(minChargeEth.toFixed(18));
    const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const description = `AI call to ${service.name} (SentinelAI)`;
    const xPaymentHeader = req.headers["x-payment"];
    const aiBody = buildAiBodyFromRequest(req.body);

    if (!xPaymentHeader && aiBody) {
      const fhe = await tryFheAiPayment({
        userWallet: req.user.walletAddress,
        service,
        aiBody,
        accessTokenId: null,
      });
      if (fhe.handled) {
        return res.status(fhe.status).json(fhe.body);
      }
    }

    if (!xPaymentHeader) {
      const requirements = buildPaymentRequirements({
        payTo: creatorWallet,
        amountWei,
        resource,
        description,
      });
      return send402Response(res, requirements);
    }

    const verification = await verifyX402Payment({
      xPaymentHeader,
      expectedReceiver: creatorWallet,
      expectedWei: amountWei,
      resource,
      description,
    });

    if (!verification.valid) {
      return res.status(402).json({ error: verification.error });
    }

    const userWallet = canonicalWalletAddress(req.user.walletAddress);

    let aiResult;
    try {
      aiResult = await forwardChatCompletion(service, req.body, res, { stream: !!req.body.stream });
    } catch (e) {
      return res.status(502).json({ error: "AI provider error", detail: e?.message });
    }

    const chargeEth = computeChargeEth(
      aiResult?.usage?.total_tokens ?? 0,
      service.pricePerThousandTokens,
      service.minimumChargeEth
    );

    await ApiUsageLog.create({
      userId: req.user.userId,
      userWallet,
      serviceId: service._id,
      provider: service.provider,
      tokensUsed: aiResult?.usage?.total_tokens ?? 0,
      amountEth: chargeEth,
      txId: verification.txHash,
      paymentMethod: "x402",
    }).catch(() => {});

    if (!req.body.stream) {
      const net = getNetworkConfig();
      return res.json({
        ...aiResult,
        sentinelReceipt: {
          paymentTxHash: verification.txHash,
          chargeEth,
          explorerUrl: explorerTxUrl(verification.txHash),
          payer: verification.senderAddress,
          network: net.name,
        },
      });
    }
  } catch (e) {
    console.error("[x402/use]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
