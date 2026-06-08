import { Queue } from "bullmq";
import { getRedisConnection, isRedisAvailable } from "./publishingQueue.js";

let gatewayQueue = null;
let lastGatewayQueueErrorLogged = 0;

export function getGatewayQueue() {
  if (!isRedisAvailable()) return null;
  if (!gatewayQueue) {
    gatewayQueue = new Queue("gateway", { connection: getRedisConnection() });
    gatewayQueue.on("error", (err) => {
      const now = Date.now();
      if (now - lastGatewayQueueErrorLogged > 10000) {
        console.warn("[gatewayQueue] Redis connection error:", err?.message || err);
        lastGatewayQueueErrorLogged = now;
      }
    });
  }
  return gatewayQueue;
}

export async function enqueueGatewayJob(name, data) {
  if (!isRedisAvailable()) return false;
  try {
    const q = getGatewayQueue();
    if (!q) return false;
    await q.add(name, data, {
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  } catch (err) {
    console.warn("[gatewayQueue] enqueue failed, inline fallback:", err?.message || err);
    return false;
  }
  return true;
}
