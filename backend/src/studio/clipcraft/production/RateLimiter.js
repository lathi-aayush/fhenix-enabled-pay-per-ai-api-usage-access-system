// @filename: backend/src/studio/clipcraft/production/RateLimiter.js

/**
 * Token-bucket rate limiter per userId.
 */
export class RateLimiter {
  /** @param {{ maxPerMinute: number }} opts */
  constructor(opts) {
    this.maxPerMinute = Math.max(1, opts.maxPerMinute);
    /** @type {Map<string, number[]>} */
    this.hits = new Map();
  }

  /**
   * @param {string} userId
   * @returns {{ allowed: boolean, retryAfterMs?: number }}
   */
  check(userId) {
    const now = Date.now();
    const windowMs = 60_000;
    const key = userId || "anonymous";
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= this.maxPerMinute) {
      const retryAfterMs = windowMs - (now - arr[0]);
      return { allowed: false, retryAfterMs };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { allowed: true };
  }

  reset(userId) {
    if (userId) this.hits.delete(userId);
    else this.hits.clear();
  }
}
