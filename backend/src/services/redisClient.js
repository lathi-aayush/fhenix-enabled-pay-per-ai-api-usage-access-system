import Redis from "ioredis";
import { getRedisConnection, isRedisAvailable } from "../queues/publishingQueue.js";

let client = null;
let lastErrorLogged = 0;

export function isRedisEnabled() {
  if (process.env.GATEWAY_DISABLE_REDIS === "1") return false;
  if (process.env.REDIS_DISABLED === "1") return false;
  return isRedisAvailable();
}

export function getRedisClient() {
  if (!isRedisEnabled()) return null;
  if (!client) {
    client = new Redis({
      ...getRedisConnection(),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      const now = Date.now();
      if (now - lastErrorLogged > 10000) {
        console.warn("[redis]", err?.message || err);
        lastErrorLogged = now;
      }
    });
  }
  return client;
}

export async function redisGet(key) {
  const r = getRedisClient();
  if (!r) return null;
  try {
    if (r.status !== "ready") await r.connect();
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key, value, ttlSeconds) {
  const r = getRedisClient();
  if (!r) return false;
  try {
    if (r.status !== "ready") await r.connect();
    if (ttlSeconds) {
      await r.set(key, value, "EX", ttlSeconds);
    } else {
      await r.set(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export async function redisIncrBy(key, delta) {
  const r = getRedisClient();
  if (!r) return null;
  try {
    if (r.status !== "ready") await r.connect();
    return await r.incrby(key, delta);
  } catch {
    return null;
  }
}

export async function redisDecrBy(key, delta) {
  const r = getRedisClient();
  if (!r) return null;
  try {
    if (r.status !== "ready") await r.connect();
    return await r.decrby(key, delta);
  } catch {
    return null;
  }
}
