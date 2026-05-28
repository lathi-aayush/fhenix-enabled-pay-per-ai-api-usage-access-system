import { Queue } from "bullmq";

let lastQueueErrorLogged = 0;
let publishQueue = null;

let connectionOptions = {};
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

try {
  const parsed = new URL(redisUrl);
  connectionOptions = {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname ? Number(parsed.pathname.split("/")[1]) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
} catch (e) {
  console.error("[Queue] Failed to parse REDIS_URL, using default localhost:", e.message);
  connectionOptions = {
    host: "localhost",
    port: 6379,
  };
}

const redisConnection = {
  ...connectionOptions,
  maxRetriesPerRequest: null,
  retryStrategy() {
    return 10000;
  },
};

/** Lazy init — avoids Redis connection spam on module import when Redis is off */
export function getPublishingQueue() {
  if (!publishQueue) {
    publishQueue = new Queue("publish", { connection: redisConnection });
    publishQueue.on("error", (err) => {
      const now = Date.now();
      if (now - lastQueueErrorLogged > 10000) {
        console.error("[Queue] Redis connection error:", err.message || err);
        lastQueueErrorLogged = now;
      }
    });
  }
  return publishQueue;
}

export function getRedisConnection() {
  return redisConnection;
}
