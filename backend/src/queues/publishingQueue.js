import Redis from "ioredis";
import { Queue } from "bullmq";

let lastQueueErrorLogged = 0;
let publishQueue = null;
/** @type {boolean | null} */
let redisAvailable = null;
/** @type {object | null} */
let connectionOptions = null;

function normalizeRedisUrl(raw) {
  const trimmed = String(raw || "").trim().replace(/^["']|["']$/g, "");
  return trimmed || "redis://localhost:6379";
}

function buildConnectionOptions() {
  const redisUrl = normalizeRedisUrl(process.env.REDIS_URL);
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      username: parsed.username || undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.split("/")[1]) : undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch (e) {
    console.error("[Queue] Failed to parse REDIS_URL, using default localhost:", e.message);
    return {
      host: "localhost",
      port: 6379,
    };
  }
}

export function getConnectionOptions() {
  if (!connectionOptions) {
    connectionOptions = buildConnectionOptions();
  }
  return connectionOptions;
}

function buildRedisConnection() {
  return {
    ...getConnectionOptions(),
    maxRetriesPerRequest: null,
    retryStrategy() {
      return isRedisAvailable() ? 10000 : null;
    },
  };
}

function attachRedisErrorSilencer(client) {
  client.on("error", () => {});
  return client;
}

export function isRedisAvailable() {
  if (process.env.REDIS_DISABLED === "1") return false;
  return redisAvailable === true;
}

/** Probe Redis once at startup so workers/queues stay off when Redis is not running. */
export async function initRedisAvailability() {
  if (process.env.REDIS_DISABLED === "1") {
    redisAvailable = false;
    console.log("[redis] Disabled via REDIS_DISABLED=1");
    return false;
  }
  if (redisAvailable !== null) return redisAvailable;

  connectionOptions = null;
  const opts = getConnectionOptions();
  const probe = attachRedisErrorSilencer(
    new Redis({
      ...opts,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      lazyConnect: true,
      retryStrategy: () => null,
    })
  );

  try {
    await probe.connect();
    await probe.ping();
    redisAvailable = true;
    console.log(`[redis] Connected (${opts.host}:${opts.port})`);
  } catch {
    redisAvailable = false;
    console.warn(
      `[redis] Not reachable at ${opts.host}:${opts.port} — background workers skipped. ` +
        `Run Redis, set REDIS_URL, or add REDIS_DISABLED=1 to backend/.env`
    );
  } finally {
    try {
      await probe.quit();
    } catch {
      probe.disconnect();
    }
  }
  return redisAvailable;
}

/** Lazy init — avoids Redis connection spam on module import when Redis is off */
export function getPublishingQueue() {
  if (!isRedisAvailable()) return null;
  if (!publishQueue) {
    publishQueue = new Queue("publish", { connection: buildRedisConnection() });
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
  return buildRedisConnection();
}
