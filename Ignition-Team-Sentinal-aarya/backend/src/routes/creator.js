import { Router } from "express";
import { query, validationResult } from "express-validator";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { creatorServicesOwnedBy } from "../utils/userWallet.js";

const router = Router();

/** Successful completions only (excludes legacy docs without `success`) */
const SUCCESS_LOG_MATCH = {
  $or: [{ success: true }, { success: { $exists: false } }],
};

router.get(
  "/services",
  requireAuth,
  requireRole("creator"),
  async (req, res) => {
    const list = await Service.find(creatorServicesOwnedBy(req.user.walletAddress))
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      list.map(({ encryptedApiKey: _e, ...rest }) => ({
        ...rest,
        providerConfigured: Boolean(rest.aiProvider && _e),
      }))
    );
  }
);

router.get("/stats", requireAuth, requireRole("creator"), async (req, res) => {
  const services = await Service.find(creatorServicesOwnedBy(req.user.walletAddress)).lean();
  const ids = services.map((s) => s._id);
  if (ids.length === 0) {
    return res.json({
      totalRevenue: 0,
      totalUses: 0,
      totalTokensServed: 0,
      serviceCount: 0,
      services: [],
    });
  }

  const perServiceAgg = await ApiUsageLog.aggregate([
    {
      $match: {
        serviceId: { $in: ids },
        ...SUCCESS_LOG_MATCH,
      },
    },
    {
      $group: {
        _id: "$serviceId",
        calls: { $sum: 1 },
        earnedAlgo: { $sum: "$amountAlgo" },
        tokensServed: { $sum: { $ifNull: ["$totalTokens", 0] } },
      },
    },
  ]);

  const byService = Object.fromEntries(
    perServiceAgg.map((row) => [
      String(row._id),
      { calls: row.calls, earnedAlgo: row.earnedAlgo, tokensServed: row.tokensServed ?? 0 },
    ])
  );

  const [totalsRow] = await ApiUsageLog.aggregate([
    {
      $match: {
        serviceId: { $in: ids },
        ...SUCCESS_LOG_MATCH,
      },
    },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        totalEarned: { $sum: "$amountAlgo" },
        totalTokensServed: { $sum: { $ifNull: ["$totalTokens", 0] } },
      },
    },
  ]);

  const totalUses = totalsRow?.totalCalls ?? 0;
  const totalRevenue = totalsRow?.totalEarned ?? 0;
  const totalTokensServed = totalsRow?.totalTokensServed ?? 0;

  const safe = services.map(({ encryptedApiKey: _e, ...rest }) => {
    const sid = String(rest._id);
    const agg = byService[sid] || { calls: 0, earnedAlgo: 0, tokensServed: 0 };
    return {
      ...rest,
      providerConfigured: Boolean(rest.aiProvider && _e),
      logCalls: agg.calls,
      logEarnedAlgo: agg.earnedAlgo,
      logTokensServed: agg.tokensServed,
    };
  });

  res.json({
    totalRevenue,
    totalUses,
    totalTokensServed,
    serviceCount: services.length,
    services: safe,
  });
});

router.get(
  "/usage",
  requireAuth,
  requireRole("creator"),
  query("limit").optional().isInt({ min: 1, max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const mine = await Service.find(creatorServicesOwnedBy(req.user.walletAddress))
      .select("_id")
      .lean();
    const serviceIds = mine.map((s) => s._id);
    if (serviceIds.length === 0) {
      return res.json([]);
    }
    const logs = await ApiUsageLog.find({ serviceId: { $in: serviceIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("serviceId", "title pricePerThousandTokens minimumChargeAlgo creatorWallet")
      .lean();
    res.json(
      logs.map((l) => ({
        id: l._id,
        createdAt: l.createdAt,
        userWallet: l.userWallet,
        developerWallet: l.developerWallet,
        amountAlgo: l.amountAlgo,
        chargeAlgo: l.chargeAlgo ?? l.amountAlgo,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        aiProvider: l.aiProvider,
        modelName: l.modelName,
        paymentTxId: l.paymentTxId ?? l.payoutTxId,
        paymentRef: l.paymentRef,
        success: l.success !== false,
        errorDetail: l.errorDetail,
        serviceTitle: l.serviceId?.title,
        serviceId: l.serviceId?._id,
      }))
    );
  }
);

export default router;
