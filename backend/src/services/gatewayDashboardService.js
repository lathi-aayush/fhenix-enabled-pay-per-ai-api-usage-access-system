import { UsageRecord } from "../models/UsageRecord.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { DailyStats } from "../models/DailyStats.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { AlertConfig } from "../models/AlertConfig.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { Service } from "../models/Service.js";
import { User } from "../models/User.js";
import { getBalanceCents } from "./gatewayBalanceService.js";
import { getDeveloperEarningsSummary } from "./gatewayPayoutService.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";
import {
  consumerPeriodKeys,
  developerPeriodKeys,
  readPeriodCounters,
} from "./gatewayPeriodStats.js";

const LOW_BALANCE_CENTS = Number(process.env.GATEWAY_LOW_BALANCE_WARN_CENTS || 500);

export async function getConsumerDashboard(userId) {
  const id = String(userId);
  const balanceCents = await getBalanceCents(id);
  const keys = consumerPeriodKeys(id);

  const [calls, spend, tokens, totalCalls, totalTokens, trend, recentLogs, recentTx, billingTx, projectAgg, alerts] =
    await Promise.all([
      readPeriodCounters("calls", keys.calls),
      readPeriodCounters("spend", keys.spend),
      readPeriodCounters("tokens", keys.tokens),
      UsageRecord.countDocuments({ consumerId: userId, billingStatus: "charged" }),
      UsageRecord.aggregate([
        { $match: { consumerId: userId, billingStatus: "charged" } },
        { $group: { _id: null, t: { $sum: "$tokensTotal" } } },
      ]),
      DailyStats.find({ entityType: "consumer", entityId: userId })
        .sort({ date: -1 })
        .limit(30)
        .lean(),
      UsageRecord.find({ consumerId: userId })
        .sort({ timestamp: -1 })
        .limit(30)
        .populate("apiId", "name proxySlug category")
        .lean(),
      LedgerTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      LedgerTransaction.find({
        userId,
        type: { $in: ["deduction", "deposit", "credit"] },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
      UsageRecord.aggregate([
        { $match: { consumerId: userId, billingStatus: "charged", projectId: { $ne: null } } },
        {
          $group: {
            _id: "$projectId",
            calls: { $sum: 1 },
            spendCents: { $sum: "$costCents" },
            tokens: { $sum: "$tokensTotal" },
          },
        },
        { $sort: { spendCents: -1 } },
        { $limit: 10 },
      ]),
      AlertConfig.find({ userId, isActive: true }).lean(),
    ]);

  // --- Merge legacy ApiUsageLog data ---
  let legacyStats = { calls: 0, spentAlgo: 0, tokens: 0 };
  let legacyRecentLogs = [];
  try {
    const user = await User.findById(userId).select("walletAddress").lean();
    const rawWallet = user?.walletAddress;
    const wallet = rawWallet ? canonicalWalletAddress(rawWallet) : null;
    if (wallet) {
      const [legacyAgg, legacyLogs] = await Promise.all([
        ApiUsageLog.aggregate([
          { $match: { userWallet: wallet, $or: [{ success: true }, { success: { $exists: false } }] } },
          {
            $group: {
              _id: null,
              calls: { $sum: 1 },
              algoSpent: { $sum: { $ifNull: ["$amountAlgo", 0] } },
              tokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
            },
          },
        ]),
        ApiUsageLog.find({ userWallet: wallet })
          .sort({ createdAt: -1 })
          .limit(15)
          .populate("serviceId", "title")
          .lean(),
      ]);
      const agg = legacyAgg[0] || {};
      legacyStats = {
        calls: agg.calls || 0,
        spentAlgo: agg.algoSpent || 0,
        tokens: agg.tokens || 0,
      };
      legacyRecentLogs = legacyLogs;
    }
  } catch (e) {
    console.warn("[consumerDash] legacy data failed:", e?.message);
  }

  const subs = await GatewaySubscription.find({ consumerId: userId, isActive: true })
    .populate("apiId", "name proxySlug pricePerUnit pricingModel category")
    .lean();

  const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
  return {
    rate,
    balanceCents,
    balanceUsd: (balanceCents / 100).toFixed(2),
    balanceAlgo: balanceCents / rate,
    lowBalance: balanceCents <= LOW_BALANCE_CENTS,
    lowBalanceThresholdCents: LOW_BALANCE_CENTS,
    period: {
      calls,
      spendCents: spend,
      spendAlgo: {
        today: (spend.today || 0) / rate,
        week: (spend.week || 0) / rate,
        month: (spend.month || 0) / rate,
      },
      tokens,
    },
    totals: {
      apiCalls: totalCalls + legacyStats.calls,
      gatewayCalls: totalCalls,
      legacyCalls: legacyStats.calls,
      tokens: (totalTokens[0]?.t || 0) + legacyStats.tokens,
      legacySpentAlgo: legacyStats.spentAlgo,
      gatewaySpentCents: spend.month || 0,
    },
    trend: trend.reverse(),
    subscriptions: subs.map((s) => ({
      id: s._id,
      apiName: s.apiId?.name,
      proxySlug: s.apiId?.proxySlug,
      proxyUrl: s.apiId ? `/proxy/${s.apiId.proxySlug}` : null,
      pricePerUnitCents: s.apiId?.pricePerUnit,
      pricePerUnitAlgo: (s.apiId?.pricePerUnit || 0) / rate,
      pricingModel: s.apiId?.pricingModel,
    })),
    recentLogs: [
      ...recentLogs.map((l) => ({
        id: l._id,
        requestId: l.requestId,
        apiName: l.apiId?.name,
        proxySlug: l.apiId?.proxySlug,
        apiKeyPrefix: l.apiKeyPrefix,
        projectId: l.projectId,
        timestamp: l.timestamp,
        method: l.method,
        httpStatus: l.httpStatus,
        costCents: l.costCents,
        costAlgo: (l.costCents || 0) / rate,
        tokensTotal: l.tokensTotal,
        requestStatus: l.requestStatus,
        responseTimeMs: l.responseTimeMs,
        source: "gateway",
      })),
      ...legacyRecentLogs.map((l) => ({
        id: l._id,
        requestId: null,
        apiName: l.serviceId?.title || "Legacy API",
        proxySlug: null,
        apiKeyPrefix: null,
        projectId: null,
        timestamp: l.createdAt,
        method: "POST",
        httpStatus: l.success === false ? 500 : 200,
        costCents: Math.round((l.amountAlgo || 0) * rate),
        costAlgo: l.amountAlgo || l.chargeAlgo || 0,
        tokensTotal: l.totalTokens || 0,
        requestStatus: l.success === false ? "failed" : "success",
        responseTimeMs: null,
        source: "legacy",
        paymentTxId: l.paymentTxId || null,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30),
    recentTransactions: recentTx.map((tx) => ({
      ...tx,
      amountAlgo: (tx.amountCents || 0) / rate,
      balanceAfterAlgo: tx.balanceAfterCents != null ? tx.balanceAfterCents / rate : undefined,
    })),
    billingHistory: billingTx.map((tx) => ({
      ...tx,
      amountAlgo: (tx.amountCents || 0) / rate,
      balanceAfterAlgo: tx.balanceAfterCents != null ? tx.balanceAfterCents / rate : undefined,
    })),
    projectAnalytics: projectAgg.map((p) => ({
      ...p,
      spendAlgo: (p.spendCents || 0) / rate,
    })),
    activeAlerts: alerts,
  };
}

export async function getDeveloperDashboard(userId) {
  const id = String(userId);
  const earnings = await getDeveloperEarningsSummary(userId);
  const keys = developerPeriodKeys(id);

  const [calls, revenue, apis, trend, perApiAgg, activeConsumers, recentErrors] = await Promise.all([
    readPeriodCounters("calls", keys.calls),
    readPeriodCounters("revenue", keys.revenue),
    ProxyApi.find({ developerId: userId }).select("-authHeaderEncrypted").lean(),
    DailyStats.find({ entityType: "developer", entityId: userId })
      .sort({ date: -1 })
      .limit(30)
      .lean(),
    UsageRecord.aggregate([
      { $match: { developerId: userId, billingStatus: "charged" } },
      {
        $group: {
          _id: "$apiId",
          calls: { $sum: 1 },
          revenueCents: { $sum: "$costCents" },
          avgLatency: { $avg: "$responseTimeMs" },
          errors: {
            $sum: { $cond: [{ $eq: ["$requestStatus", "success"] }, 0, 1] },
          },
        },
      },
    ]),
    GatewaySubscription.distinct("consumerId", { apiId: { $in: [] } }),
    UsageRecord.find({ developerId: userId, requestStatus: { $ne: "success" } })
      .sort({ timestamp: -1 })
      .limit(15)
      .populate("apiId", "name proxySlug")
      .lean(),
  ]);

  const apiIds = apis.map((a) => a._id);
  const consumers =
    apiIds.length > 0
      ? await GatewaySubscription.distinct("consumerId", {
          apiId: { $in: apiIds },
          isActive: true,
        })
      : [];

  // --- Merge legacy Service data ---
  let legacyServices = [];
  let legacyRevenue = 0;
  let legacyCalls = 0;
  let legacyTokensServed = 0;
  try {
    const user = await User.findById(userId).select("walletAddress").lean();
    const rawWallet = user?.walletAddress;
    const wallet = rawWallet ? canonicalWalletAddress(rawWallet) : null;
    if (wallet) {
      legacyServices = await Service.find({ creatorWallet: wallet }).lean();
      legacyServices.forEach((s) => {
        legacyRevenue += s.totalRevenue || 0;
        legacyCalls += s.totalUses || 0;
      });

      // Get legacy token stats
      const legacyTokenAgg = await ApiUsageLog.aggregate([
        { $match: { developerWallet: wallet, $or: [{ success: true }, { success: { $exists: false } }] } },
        { $group: { _id: null, tokens: { $sum: { $ifNull: ["$totalTokens", 0] } } } },
      ]);
      legacyTokensServed = legacyTokenAgg[0]?.tokens || 0;
    }
  } catch (e) {
    console.warn("[devDash] legacy data failed:", e?.message);
  }

  const apiMap = Object.fromEntries(apis.map((a) => [String(a._id), a]));

  const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);

  // Sum gateway revenue
  const gatewayTotalRevenueCents = perApiAgg.reduce((acc, r) => acc + (r.revenueCents || 0), 0);
  const gatewayTotalCalls = perApiAgg.reduce((acc, r) => acc + (r.calls || 0), 0);

  return {
    rate,
    earnings: {
      ...earnings,
      availableAlgo: (earnings.availableCents || 0) / rate,
      pendingAlgo: (earnings.pendingCents || 0) / rate,
      paidOutAlgo: (earnings.paidOutCents || 0) / rate,
      minPayoutAlgo: (earnings.minPayoutCents || 0) / rate,
    },
    period: {
      calls,
      revenueCents: revenue,
      revenueAlgo: {
        today: (revenue.today || 0) / rate,
        week: (revenue.week || 0) / rate,
        month: (revenue.month || 0) / rate,
      },
    },
    totals: {
      gatewayCalls: gatewayTotalCalls,
      legacyCalls,
      totalCalls: gatewayTotalCalls + legacyCalls,
      gatewayRevenueCents: gatewayTotalRevenueCents,
      gatewayRevenueAlgo: gatewayTotalRevenueCents / rate,
      legacyRevenueAlgo: legacyRevenue,
      totalRevenueAlgo: (gatewayTotalRevenueCents / rate) + legacyRevenue,
      legacyTokensServed,
    },
    activeConsumers: consumers.length,
    apis: apis.map((a) => {
      const stats = perApiAgg.find((r) => String(r._id) === String(a._id)) || {
        calls: 0,
        revenueCents: 0,
        avgLatency: 0,
        errors: 0,
      };
      const errorRate = stats.calls > 0 ? stats.errors / stats.calls : 0;
      return {
        ...a,
        proxyUrl: `/proxy/${a.proxySlug}`,
        pricePerUnitAlgo: (a.pricePerUnit || 0) / rate,
        stats: {
          ...stats,
          revenueAlgo: (stats.revenueCents || 0) / rate,
          errorRatePct: Math.round(errorRate * 1000) / 10,
          health: errorRate > 0.15 ? "degraded" : "healthy",
        },
      };
    }),
    legacyServices: legacyServices.map((s) => ({
      id: s._id,
      title: s.title,
      description: s.description,
      aiProvider: s.aiProvider,
      modelName: s.modelName,
      totalRevenue: s.totalRevenue || 0,
      totalUses: s.totalUses || 0,
      isPaused: s.isPaused,
    })),
    trend: trend.reverse().map((t) => ({
      ...t,
      revenueAlgo: (t.revenueCents || 0) / rate,
    })),
    recentErrors: recentErrors.map((r) => ({
      requestId: r.requestId,
      apiName: r.apiId?.name,
      httpStatus: r.httpStatus,
      errorMessage: r.errorMessage,
      timestamp: r.timestamp,
    })),
    apiMap,
  };
}

export async function getUsageLogs(userId, { role, page = 1, limit = 25, apiId } = {}) {
  const filter =
    role === "creator" || role === "developer"
      ? { developerId: userId }
      : { consumerId: userId };
  if (apiId) filter.apiId = apiId;

  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    UsageRecord.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("apiId", "name proxySlug")
      .lean(),
    UsageRecord.countDocuments(filter),
  ]);

  const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
  return {
    page,
    limit,
    total,
    items: items.map((l) => ({
      id: l._id,
      requestId: l.requestId,
      apiName: l.apiId?.name,
      proxySlug: l.apiId?.proxySlug,
      apiKeyPrefix: l.apiKeyPrefix,
      timestamp: l.timestamp,
      method: l.method,
      endpoint: l.endpoint,
      httpStatus: l.httpStatus,
      responseTimeMs: l.responseTimeMs,
      tokensTotal: l.tokensTotal,
      costCents: l.costCents,
      costAlgo: (l.costCents || 0) / rate,
      requestStatus: l.requestStatus,
      billingStatus: l.billingStatus,
      errorMessage: l.errorMessage,
    })),
  };
}
