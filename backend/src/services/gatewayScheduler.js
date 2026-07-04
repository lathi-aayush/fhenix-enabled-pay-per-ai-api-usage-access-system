import { recoverStaleGatewayLocks } from "./gatewayCrashRecovery.js";
import { aggregateYesterdayStats } from "./dailyStatsAggregator.js";
import { enqueueGatewayJob } from "../queues/gatewayQueue.js";
import { scanApiHealthAndAlert } from "./gatewayHealthMonitor.js";

let intervals = [];

export function startGatewayScheduler() {
  if (process.env.GATEWAY_DISABLE_SCHEDULER === "1") {
    console.log("[gatewayScheduler] disabled");
    return;
  }

  const recoveryMs = Number(process.env.GATEWAY_RECOVERY_INTERVAL_MS || 300000);

  intervals.push(
    setInterval(() => {
      void recoverStaleGatewayLocks().catch((e) =>
        console.warn("[gatewayScheduler] recovery", e?.message)
      );
    }, recoveryMs)
  );

  scheduleDailyStatsCron();

  const healthMs = Number(process.env.GATEWAY_HEALTH_SCAN_MS || 600000);
  intervals.push(
    setInterval(() => {
      void scanApiHealthAndAlert().catch((e) =>
        console.warn("[gatewayScheduler] health", e?.message)
      );
    }, healthMs)
  );

  console.log("[gatewayScheduler] recovery + daily stats + health active");
}

function scheduleDailyStatsCron() {
  const run = () => {
    void enqueueGatewayJob("dailyStats", {}).catch(() => {
      void aggregateYesterdayStats().catch((e) =>
        console.warn("[gatewayScheduler] dailyStats", e?.message)
      );
    });
  };

  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(0, 5, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const delay = next.getTime() - now.getTime();

  setTimeout(() => {
    run();
    intervals.push(setInterval(run, 24 * 60 * 60 * 1000));
  }, delay);
}

export function stopGatewayScheduler() {
  for (const id of intervals) clearInterval(id);
  intervals = [];
}
