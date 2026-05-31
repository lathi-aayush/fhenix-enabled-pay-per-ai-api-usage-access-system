import crypto from "crypto";
import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { User } from "../models/User.js";
import { CreatorWebhook, CREATOR_WEBHOOK_EVENTS } from "../models/CreatorWebhook.js";
import { WebhookDelivery } from "../models/WebhookDelivery.js";
import { requireAuth, requireCreator } from "../middleware/auth.js";
import { canonicalWalletAddress, creatorServicesOwnedBy } from "../utils/userWallet.js";
import { maskWebhookSecret, sendTestWebhook } from "../services/creatorWebhookDispatcher.js";
import {
  computeCreatorWithdrawalBalances,
  listCreatorWithdrawals,
  MIN_WITHDRAWAL_ALGO,
  requestCreatorWithdrawal,
} from "../services/creatorWithdrawalService.js";

const router = Router();
const MAX_WEBHOOKS_PER_CREATOR = 10;
const REGISTERABLE_EVENTS = CREATOR_WEBHOOK_EVENTS.filter((e) => e !== "webhook.test");

function stripServiceForPublic(s) {
  const { encryptedApiKey: _e, ...rest } = s;
  return {
    ...rest,
    providerConfigured: Boolean(s.aiProvider && s.encryptedApiKey),
    averageRating: Number(s.averageRating) || 0,
    reviewCount: Number(s.reviewCount) || 0,
  };
}

router.get(
  "/public/:walletAddress",
  param("walletAddress").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let wallet;
    try {
      wallet = canonicalWalletAddress(req.params.walletAddress);
    } catch {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const profileUser = await User.findOne({ walletAddress: wallet })
      .select("displayName photoURL role createdAt")
      .lean();

    const services = await Service.find({
      ...creatorServicesOwnedBy(wallet),
      isPaused: false,
    })
      .sort({ totalUses: -1, createdAt: -1 })
      .lean();

    const totalRevenue = services.reduce((sum, s) => sum + (Number(s.totalRevenue) || 0), 0);
    const totalUses = services.reduce((sum, s) => sum + (Number(s.totalUses) || 0), 0);

    res.json({
      walletAddress: wallet,
      displayName: profileUser?.displayName ?? null,
      photoURL: profileUser?.photoURL ?? null,
      role: profileUser?.role ?? "creator",
      memberSince: profileUser?.createdAt ?? null,
      totalRevenue,
      totalUses,
      serviceCount: services.length,
      services: services.map(stripServiceForPublic),
    });
  }
);

/** Successful completions only (excludes legacy docs without `success`) */
const SUCCESS_LOG_MATCH = {
  $or: [{ success: true }, { success: { $exists: false } }],
};

router.get(
  "/services",
  requireAuth,
  requireCreator,
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

router.get("/stats", requireAuth, requireCreator, async (req, res) => {
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
  requireCreator,
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

function serializeWebhook(doc, { includeSecret = false } = {}) {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id: row._id,
    url: row.url,
    description: row.description ?? "",
    events: row.events ?? [],
    enabled: row.enabled !== false,
    secretPreview: maskWebhookSecret(row.secret),
    secret: includeSecret ? row.secret : undefined,
    lastDeliveryAt: row.lastDeliveryAt ?? null,
    lastDeliveryStatus: row.lastDeliveryStatus ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/webhooks", requireAuth, requireCreator, async (req, res) => {
  const list = await CreatorWebhook.find({ creatorWallet: req.user.walletAddress })
    .sort({ createdAt: -1 })
    .lean();
  res.json(list.map((row) => serializeWebhook(row)));
});

router.post(
  "/webhooks",
  requireAuth,
  requireCreator,
  body("url").isString().trim().isURL({ protocols: ["http", "https"], require_protocol: true }),
  body("description").optional({ values: "null" }).isString().trim().isLength({ max: 200 }),
  body("events")
    .optional()
    .isArray({ min: 1, max: REGISTERABLE_EVENTS.length })
    .custom((events) => events.every((e) => REGISTERABLE_EVENTS.includes(e))),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const count = await CreatorWebhook.countDocuments({ creatorWallet: req.user.walletAddress });
    if (count >= MAX_WEBHOOKS_PER_CREATOR) {
      return res.status(400).json({ error: `Maximum ${MAX_WEBHOOKS_PER_CREATOR} webhooks per creator` });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const doc = await CreatorWebhook.create({
      creatorWallet: req.user.walletAddress,
      url: req.body.url.trim(),
      secret,
      description: String(req.body.description ?? "").trim(),
      events: req.body.events?.length ? req.body.events : ["api.purchase.completed"],
    });

    res.status(201).json(serializeWebhook(doc, { includeSecret: true }));
  }
);

router.get(
  "/webhooks/deliveries",
  requireAuth,
  requireCreator,
  query("limit").optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const rows = await WebhookDelivery.find({ creatorWallet: req.user.walletAddress })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(
      rows.map((r) => ({
        id: r._id,
        webhookId: r.webhookId,
        event: r.event,
        url: r.url,
        success: r.success,
        httpStatus: r.httpStatus ?? null,
        errorMessage: r.errorMessage ?? null,
        attemptCount: r.attemptCount,
        payloadId: r.payloadId,
        createdAt: r.createdAt,
      }))
    );
  }
);

router.patch(
  "/webhooks/:id",
  requireAuth,
  requireCreator,
  param("id").isMongoId(),
  body("url").optional().isString().trim().isURL({ protocols: ["http", "https"], require_protocol: true }),
  body("description").optional({ values: "null" }).isString().trim().isLength({ max: 200 }),
  body("enabled").optional().isBoolean(),
  body("events")
    .optional()
    .isArray({ min: 1, max: REGISTERABLE_EVENTS.length })
    .custom((events) => events.every((e) => REGISTERABLE_EVENTS.includes(e))),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doc = await CreatorWebhook.findOne({
      _id: req.params.id,
      creatorWallet: req.user.walletAddress,
    });
    if (!doc) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (typeof req.body.url === "string") doc.url = req.body.url.trim();
    if (typeof req.body.description === "string") doc.description = req.body.description.trim();
    if (typeof req.body.enabled === "boolean") doc.enabled = req.body.enabled;
    if (Array.isArray(req.body.events) && req.body.events.length > 0) doc.events = req.body.events;

    await doc.save();
    res.json(serializeWebhook(doc));
  }
);

router.delete(
  "/webhooks/:id",
  requireAuth,
  requireCreator,
  param("id").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doc = await CreatorWebhook.findOneAndDelete({
      _id: req.params.id,
      creatorWallet: req.user.walletAddress,
    });
    if (!doc) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json({ ok: true });
  }
);

router.post(
  "/webhooks/:id/test",
  requireAuth,
  requireCreator,
  param("id").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const doc = await CreatorWebhook.findOne({
      _id: req.params.id,
      creatorWallet: req.user.walletAddress,
    });
    if (!doc) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    const result = await sendTestWebhook(doc);
    res.json({
      success: result.success,
      httpStatus: result.httpStatus ?? null,
      errorMessage: result.errorMessage ?? null,
      attemptCount: result.attemptCount,
    });
  }
);

router.get(
  "/withdrawals",
  requireAuth,
  requireCreator,
  query("limit").optional().isInt({ min: 1, max: 200 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const limit = parseInt(req.query.limit, 10) || 50;
    const [balances, history] = await Promise.all([
      computeCreatorWithdrawalBalances(req.user.walletAddress),
      listCreatorWithdrawals(req.user.walletAddress, { limit }),
    ]);

    res.json({
      totalEarned: balances.totalEarned,
      totalWithdrawn: balances.totalWithdrawn,
      withdrawable: balances.withdrawable,
      pendingWithdrawals: balances.pendingWithdrawals,
      minWithdrawalAlgo: MIN_WITHDRAWAL_ALGO,
      creatorWallet: req.user.walletAddress,
      withdrawals: history,
    });
  }
);

router.post(
  "/withdraw",
  requireAuth,
  requireCreator,
  body("amount").isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user.userId) {
      return res.status(400).json({ error: "User account required for withdrawals" });
    }

    try {
      const result = await requestCreatorWithdrawal({
        creatorWallet: req.user.walletAddress,
        userId: req.user.userId,
        amountAlgo: Number(req.body.amount),
      });
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 500;
      if (status === 400) {
        return res.status(400).json({
          error: err.message,
          totalEarned: err.balances?.totalEarned,
          totalWithdrawn: err.balances?.totalWithdrawn,
          withdrawable: err.balances?.withdrawable,
        });
      }
      if (status === 503) {
        return res.status(503).json({
          error: err.message,
          code: err.code || "TREASURY_NOT_CONFIGURED",
        });
      }
      if (status === 502) {
        return res.status(400).json({
          error: err.message,
          withdrawalId: err.withdrawalId ?? null,
        });
      }
      console.error("[creator] withdraw", err?.message || err);
      return res.status(500).json({ error: err.message || "Withdrawal failed" });
    }
  }
);

export default router;
