import { User } from "../models/User.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { DeveloperEarning } from "../models/DeveloperEarning.js";
import { GatewayDeposit } from "../models/GatewayDeposit.js";
import { DailyStats } from "../models/DailyStats.js";
import { redisGet } from "./redisClient.js";
import { todayUtc } from "./gatewayPeriodStats.js";

export function isGatewayAdmin(user) {
  const ids = (process.env.GATEWAY_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length && ids.includes(String(user.userId))) return true;
  const wallets = (process.env.GATEWAY_ADMIN_WALLETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return wallets.length > 0 && wallets.includes(String(user.walletAddress || ""));
}

export async function getAdminDashboard() {
  const day = todayUtc();
  const sinceDay = new Date(`${day}T00:00:00.000Z`);

  const [
    activeUsers,
    activeApis,
    activeSubscriptions,
    depositsToday,
    payoutsToday,
    failedToday,
    platformRevenue,
    recentFailures,
  ] = await Promise.all([
    User.countDocuments({ walletBalanceCents: { $gt: 0 } }),
    ProxyApi.countDocuments({ isActive: true }),
    GatewaySubscription.countDocuments({ isActive: true }),
    GatewayDeposit.countDocuments({ status: "confirmed", confirmedAt: { $gte: sinceDay } }),
    LedgerTransaction.countDocuments({ type: "payout", createdAt: { $gte: sinceDay } }),
    UsageRecord.countDocuments({
      timestamp: { $gte: sinceDay },
      requestStatus: { $ne: "success" },
    }),
    DeveloperEarning.aggregate([
      { $match: { status: { $in: ["available", "paid_out", "pending"] } } },
      { $group: { _id: null, platformFees: { $sum: "$platformFeeCents" }, gross: { $sum: "$grossCents" } } },
    ]),
    UsageRecord.find({ requestStatus: { $ne: "success" } })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate("apiId", "name proxySlug")
      .lean(),
  ]);

  const callsTodayAgg = await UsageRecord.aggregate([
    { $match: { timestamp: { $gte: sinceDay }, billingStatus: "charged" } },
    {
      $group: {
        _id: null,
        calls: { $sum: 1 },
        spendCents: { $sum: "$costCents" },
        tokens: { $sum: "$tokensTotal" },
      },
    },
  ]);

  const apiHealth = await ProxyApi.find({ isActive: true })
    .select("name proxySlug callCount")
    .limit(30)
    .lean();

  const healthWithErrors = await Promise.all(
    apiHealth.map(async (a) => {
      const errKey = `api:${a._id}:errors:daily:${day}`;
      const callKey = `api:${a._id}:calls:daily:${day}`;
      const errors = parseInt((await redisGet(errKey)) || "0", 10);
      const calls = parseInt((await redisGet(callKey)) || "0", 10);
      const errorRate = calls > 0 ? errors / calls : 0;
      return {
        apiId: a._id,
        name: a.name,
        proxySlug: a.proxySlug,
        callsToday: calls,
        errorsToday: errors,
        errorRate: Math.round(errorRate * 1000) / 10,
        status: errorRate > 0.2 ? "degraded" : calls === 0 ? "idle" : "healthy",
      };
    })
  );

  const platformTrend = await DailyStats.find({ entityType: "platform" })
    .sort({ date: -1 })
    .limit(30)
    .lean();

  const rev = platformRevenue[0] || { platformFees: 0, gross: 0 };

  const rate = Number(process.env.ETH_USD_RATE || 35);
  return {
    rate,
    summary: {
      activeUsers,
      activeApis,
      activeSubscriptions,
      depositsToday,
      payoutsToday,
      failedRequestsToday: failedToday,
      callsToday: callsTodayAgg[0]?.calls || 0,
      spendTodayCents: callsTodayAgg[0]?.spendCents || 0,
      spendTodayEth: (callsTodayAgg[0]?.spendCents || 0) / rate,
      tokensToday: callsTodayAgg[0]?.tokens || 0,
      platformFeeCentsTotal: rev.platformFees,
      platformFeeEthTotal: (rev.platformFees || 0) / rate,
      grossVolumeCents: rev.gross,
      grossVolumeEth: (rev.gross || 0) / rate,
    },
    apiHealth: healthWithErrors,
    recentFailures: recentFailures.map((r) => ({
      requestId: r.requestId,
      apiName: r.apiId?.name,
      proxySlug: r.apiId?.proxySlug,
      httpStatus: r.httpStatus,
      errorMessage: r.errorMessage,
      timestamp: r.timestamp,
    })),
    platformTrend: platformTrend.reverse(),
  };
}
