import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AccessToken } from "../models/AccessToken.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { fetchAccountBalanceMicroAlgos } from "../services/algorandService.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

const router = Router();

router.get("/algo-balance", requireAuth, requireRole("user"), async (req, res) => {
  try {
    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const micro = await fetchAccountBalanceMicroAlgos(userWallet);
    res.json({
      balanceMicroAlgos: micro,
      balanceAlgo: micro / 1e6,
    });
  } catch (e) {
    console.error("[algo-balance]", e);
    res.status(502).json({
      error: "Could not load on-chain balance from indexer",
      detail: process.env.NODE_ENV === "development" ? e.message : undefined,
    });
  }
});

router.get("/proxy-keys", requireAuth, requireRole("user"), async (req, res) => {
  const userWallet = canonicalWalletAddress(req.user.walletAddress);
  const tokens = await AccessToken.find({ userWallet })
    .sort({ createdAt: -1 })
    .populate(
      "serviceId",
      "title pricePerThousandTokens minimumChargeAlgo aiProvider modelName totalUses"
    )
    .lean();
  const out = tokens.map((t) => ({
    id: t._id,
    keySuffix: t.key.slice(-8),
    key: t.key,
    createdAt: t.createdAt,
    service: t.serviceId
      ? {
          id: t.serviceId._id,
          title: t.serviceId.title,
          pricePerThousandTokens: t.serviceId.pricePerThousandTokens,
          minimumChargeAlgo: t.serviceId.minimumChargeAlgo,
          aiProvider: t.serviceId.aiProvider,
          modelName: t.serviceId.modelName,
          totalUses: t.serviceId.totalUses,
        }
      : null,
  }));
  res.json(out);
});

router.get("/usage", requireAuth, requireRole("user"), async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const userWallet = canonicalWalletAddress(req.user.walletAddress);
  const logs = await ApiUsageLog.find({ userWallet })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("serviceId", "title")
    .lean();
  res.json(
    logs.map((l) => ({
      id: l._id,
      createdAt: l.createdAt,
      amountAlgo: l.amountAlgo,
      totalTokens: l.totalTokens,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      aiProvider: l.aiProvider,
      modelName: l.modelName,
      paymentTxId: l.paymentTxId ?? l.payoutTxId,
      paymentRef: l.paymentRef,
      success: l.success !== false,
      errorDetail: l.errorDetail,
      serviceTitle: l.serviceId?.title ?? null,
      serviceId: l.serviceId?._id ?? l.serviceId,
    }))
  );
});

export default router;
