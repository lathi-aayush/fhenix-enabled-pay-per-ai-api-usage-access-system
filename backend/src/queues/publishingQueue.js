import { Queue } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let _redis = null;
let _queue = null;
let _redisUnavailable = false;

export function getRedisConnection() {
  if (_redisUnavailable) return null;
  if (_redis) return _redis;

  _redis = new IORedis(url, {
    maxRetriesPerRequest: null,
    // Stop retrying after a few failures so we don't spam the logs
    retryStrategy(times) {
      if (times > 3) {
        _redisUnavailable = true;
        _redis = null;
        return null; // stop retrying
      }
      return Math.min(times * 500, 2000);
    },
    lazyConnect: false,
  });

  _redis.on("error", (err) => {
    // Only log once, not on every retry
    if (!_redisUnavailable) {
      console.warn("[Redis] not available - publishing queue disabled. Start Redis to enable blogging queue.");
    }
  });

  _redis.on("connect", () => {
    _redisUnavailable = false;
    console.log("[Redis] connected - publishing queue enabled");
  });

  return _redis;
}

export function getPublishingQueue() {
  if (_redisUnavailable) return null;
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!_queue) {
    _queue = new Queue("publishing", {
      connection: conn,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _queue;
}

// Backward compat stubs (not used directly anymore)
export const redisConnection = null;
export const publishingQueue = null;
