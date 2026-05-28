// @filename: backend/src/studio/clipcraft/production/IdempotencyStore.js

/**
 * In-memory idempotency cache for job submissions (swap for Redis in production).
 */
export class IdempotencyStore {
  /** @type {Map<string, { jobId: string, result: object, expiresAt: number }>} */
  #map = new Map();

  /** @param {number} [ttlMs] */
  constructor(ttlMs = 86_400_000) {
    this.ttlMs = ttlMs;
  }

  #key(userId, idempotencyKey) {
    return `${userId}:${idempotencyKey}`;
  }

  get(userId, idempotencyKey) {
    this.#purge();
    const row = this.#map.get(this.#key(userId, idempotencyKey));
    if (!row || row.expiresAt < Date.now()) return null;
    return row;
  }

  set(userId, idempotencyKey, jobId, result) {
    this.#map.set(this.#key(userId, idempotencyKey), {
      jobId,
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  #purge() {
    const now = Date.now();
    for (const [k, v] of this.#map) {
      if (v.expiresAt < now) this.#map.delete(k);
    }
  }

  size() {
    this.#purge();
    return this.#map.size;
  }

  clear() {
    this.#map.clear();
  }
}
