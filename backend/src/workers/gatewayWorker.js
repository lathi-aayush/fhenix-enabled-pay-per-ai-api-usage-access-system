import { Worker } from "bullmq";
import { getRedisConnection, isRedisAvailable } from "../queues/publishingQueue.js";
import {
  writeUsageRecordInline,
  writeLedgerTxInline,
  writeEarningInline,
} from "../services/gatewayPersistence.js";
import { User } from "../models/User.js";
import { redisSet } from "../services/redisClient.js";
import { bumpPeriodCounters } from "../services/gatewayPeriodStats.js";
import { aggregateYesterdayStats } from "../services/dailyStatsAggregator.js";
import { recoverStaleGatewayLocks } from "../services/gatewayCrashRecovery.js";

async function bumpAnalyticsCounters(payload) {
  await bumpPeriodCounters(payload);
}

export function startGatewayWorker() {
  if (process.env.GATEWAY_DISABLE_WORKER === "1") {
    console.log("[gatewayWorker] disabled via GATEWAY_DISABLE_WORKER");
    return null;
  }
  if (!isRedisAvailable()) {
    return null;
  }

  const redis = getRedisConnection();

  const worker = new Worker(
    "gateway",
    async (job) => {
      switch (job.name) {
        case "usageWriter":
          if (job.data.record) {
            await writeUsageRecordInline(job.data.record);
          }
          if (job.data.analytics) {
            await bumpAnalyticsCounters(job.data.analytics);
          }
          break;
        case "analyticsBump":
          await bumpAnalyticsCounters(job.data);
          break;
        case "txWriter":
          await writeLedgerTxInline(job.data.tx);
          break;
        case "earningWriter":
          await writeEarningInline(job.data.earning);
          break;
        case "balanceSync":
          await User.findByIdAndUpdate(job.data.userId, {
            $set: { walletBalanceCents: job.data.balanceCents },
          });
          await redisSet(`balance:${job.data.userId}`, String(job.data.balanceCents), 3600);
          break;
        case "dailyStats":
          await aggregateYesterdayStats();
          break;
        case "crashRecovery":
          await recoverStaleGatewayLocks();
          break;
        default:
          console.warn("[gatewayWorker] unknown job", job.name);
      }
    },
    { connection: redis, concurrency: 4 }
  );

  worker.on("failed", (job, err) => {
    console.error("[gatewayWorker] failed", job?.name, job?.id, err?.message);
  });

  console.log("[gatewayWorker] Running (usageWriter, txWriter, earningWriter, balanceSync)");
  return worker;
}
