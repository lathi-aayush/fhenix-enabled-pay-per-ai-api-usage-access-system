import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AccessToken } from "../models/AccessToken.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { User } from "../models/User.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { getBalanceEth } from "../services/evmService.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

const router = Router();

router.get("/eth-balance", requireAuth, requireRole("user", "creator"), async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.json({ balanceWei: "0", balanceEth: 0 });
    }
    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const balanceEth = await getBalanceEth(userWallet);
    res.json({
      balanceWei: String(Math.round(balanceEth * 1e18)),
      balanceEth,
    });
  } catch (e) {
    console.error("[eth-balance]", e);
    res.status(502).json({
      error: "Could not load on-chain balance from Sepolia",
      detail: process.env.NODE_ENV === "development" ? e.message : undefined,
    });
  }
});

router.get("/proxy-keys", requireAuth, requireRole("user", "creator"), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("walletAddress sentinelApiKey").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = user._id;
    let consumerKeys = [];

    if (user.walletAddress) {
      const userWallet = canonicalWalletAddress(user.walletAddress);

      const tokens = await AccessToken.find({
        $or: [{ userId }, { userWallet, userId: { $exists: false } }, { userWallet, userId: null }],
      })
        .sort({ createdAt: -1 })
        .populate(
          "serviceId",
          "title pricePerThousandTokens minimumChargeEth aiProvider modelName totalUses creatorWallet"
        )
        .lean();

      consumerKeys = tokens
        .filter((t) => {
          if (t.userId && String(t.userId) !== String(userId)) return false;
          try {
            return canonicalWalletAddress(t.userWallet) === userWallet;
          } catch {
            return false;
          }
        })
        .map((t) => ({
          id: t._id,
          type: "consumer",
          keySuffix: t.key.slice(-8),
          key: t.key,
          createdAt: t.createdAt,
          userWallet: t.userWallet,
          service: t.serviceId
            ? {
                id: t.serviceId._id,
                title: t.serviceId.title,
                pricePerThousandTokens: t.serviceId.pricePerThousandTokens,
                minimumChargeEth: t.serviceId.minimumChargeEth,
                aiProvider: t.serviceId.aiProvider,
                modelName: t.serviceId.modelName,
                totalUses: t.serviceId.totalUses,
              }
            : null,
        }));
    }

    const [proxyApis, gatewaySubs] = await Promise.all([
      ProxyApi.find({ developerId: userId, isActive: true })
        .select("-authHeaderEncrypted")
        .sort({ updatedAt: -1 })
        .lean(),
      GatewaySubscription.find({ consumerId: userId, isActive: true })
        .populate("apiId", "name proxySlug pricePerUnit pricingModel")
        .sort({ updatedAt: -1 })
        .lean(),
    ]);

    const rate = Number(process.env.ETH_USD_RATE || 35);

    const publishedEndpoints = proxyApis.map((api) => ({
      id: api._id,
      type: "published",
      name: api.name,
      proxySlug: api.proxySlug,
      proxyUrl: `/proxy/${api.proxySlug}/chat/completions`,
      useUrl: "/api/use",
      aiProvider: api.aiProvider,
      modelName: api.modelName,
      pricingModel: api.pricingModel,
      pricePerUnitEth: (api.pricePerUnit || 0) / rate,
      callCount: api.callCount || 0,
      legacyServiceId: api.legacyServiceId,
    }));

    const gatewaySubscriptions = gatewaySubs.map((sub) => ({
      id: sub._id,
      type: "gateway",
      key: sub.developerIssuedKey,
      apiName: sub.apiId?.name,
      proxySlug: sub.apiId?.proxySlug,
      proxyUrl: sub.apiId ? `/proxy/${sub.apiId.proxySlug}/chat/completions` : null,
      pricePerUnitEth: (sub.apiId?.pricePerUnit || 0) / rate,
      pricingModel: sub.apiId?.pricingModel,
    }));

    const gatewayMasterKey = user.sentinelApiKey
      ? {
          type: "gateway_master",
          key: user.sentinelApiKey,
          label: "Sentinel gateway master key",
        }
      : null;

    res.json({
      consumerKeys,
      publishedEndpoints,
      gatewaySubscriptions,
      gatewayMasterKey,
    });
  } catch (e) {
    console.error("[proxy-keys]", e);
    res.status(500).json({ error: "Could not load proxy keys" });
  }
});

router.get("/transactions", requireAuth, requireRole("user", "creator"), async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.json({
        items: [],
        summary: {
          totalCalls: 0,
          totalTokensConsumed: 0,
          totalEthSpent: 0,
        },
      });
    }
    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const serviceId = String(req.query.serviceId || "").trim();
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : null;
    const endDateRaw = req.query.endDate ? new Date(String(req.query.endDate)) : null;
    const sortBy = String(req.query.sortBy || "newest").trim();

    const filter = { userWallet };
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      filter.serviceId = new mongoose.Types.ObjectId(serviceId);
    }
    const createdRange = {};
    if (startDate && !Number.isNaN(startDate.getTime())) {
      createdRange.$gte = startDate;
    }
    if (endDateRaw && !Number.isNaN(endDateRaw.getTime())) {
      const end = new Date(endDateRaw);
      end.setHours(23, 59, 59, 999);
      createdRange.$lte = end;
    }
    if (Object.keys(createdRange).length > 0) {
      filter.createdAt = createdRange;
    }

    let sort = { createdAt: -1 };
    if (sortBy === "oldest") sort = { createdAt: 1 };
    if (sortBy === "charge_desc" || sortBy === "highest_charge") sort = { amountEth: -1 };
    if (sortBy === "charge_asc" || sortBy === "lowest_charge") sort = { amountEth: 1 };

    const logs = await ApiUsageLog.find(filter)
      .sort(sort)
      .limit(limit)
      .populate("serviceId", "title")
      .lean();

    const items = logs.map((l) => ({
      id: l._id,
      createdAt: l.createdAt,
      serviceTitle: l.serviceId?.title ?? null,
      serviceId: l.serviceId?._id ?? l.serviceId,
      promptTokens: l.promptTokens ?? null,
      completionTokens: l.completionTokens ?? null,
      totalTokens: l.totalTokens ?? null,
      amountEth: l.amountEth,
      chargeEth: l.chargeEth ?? l.amountEth,
      proofTxId: l.proofTxId ?? null,
      success: l.success !== false,
      paymentTxId: l.paymentTxId ?? null,
    }));

    const totalCalls = items.length;
    const totalTokensConsumed = items.reduce(
      (s, x) => s + (Number(x.totalTokens) || 0),
      0
    );
    const totalEthSpent = items.reduce((s, x) => s + Number(x.amountEth || 0), 0);

    return res.json({
      items,
      summary: {
        totalCalls,
        totalTokensConsumed,
        totalEthSpent,
      },
    });
  } catch (e) {
    console.error("[user/transactions]", e?.message || e);
    return res.status(500).json({ error: "Could not load transactions" });
  }
});

router.get("/usage", requireAuth, requireRole("user", "creator"), async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.json([]);
    }
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
        amountEth: l.amountEth,
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
  } catch (e) {
    console.error("[user/usage]", e);
    res.status(500).json({ error: "Could not load usage" });
  }
});

export default router;
