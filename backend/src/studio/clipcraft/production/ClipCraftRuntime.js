// @filename: backend/src/studio/clipcraft/production/ClipCraftRuntime.js

import { loadClipCraftConfig } from "../config/loadConfig.js";
import { createClipCraftOrchestrator } from "../registry/bootstrapOrchestrator.js";
import { IdempotencyStore } from "./IdempotencyStore.js";
import { RateLimiter } from "./RateLimiter.js";
import { getMemoryQueueDepth } from "../mocks/MemoryJobQueue.js";

let singleton = null;

export class ClipCraftRuntime {
  constructor(opts = {}) {
    const config = loadClipCraftConfig({ force: opts.forceConfig });
    const boot = createClipCraftOrchestrator({
      store: opts.store,
      defaultCredits: opts.defaultCredits ?? 100,
    });
    this.config = config;
    this.registry = boot.registry;
    this.store = boot.store;
    this.orchestrator = boot.orchestrator;
    this.idempotency = new IdempotencyStore(opts.idempotencyTtlMs ?? 86_400_000);
    const rateLimit =
      opts.maxPerMinute ??
      (Number(process.env.CLIPCRAFT_RATE_LIMIT_PER_MIN) || 30);
    this.rateLimiter = new RateLimiter({ maxPerMinute: rateLimit });
    this.startedAt = Date.now();
    this._started = false;
  }

  start() {
    if (this._started) return;
    if (!this.config.enabled) return;
    this.orchestrator.startWorker(500);
    this._started = true;
  }

  getStats() {
    const o = this.orchestrator.getStats();
    return {
      ...o,
      idempotencyEntries: this.idempotency.size(),
      queueDepth: getMemoryQueueDepth(),
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  /**
   * @param {{ userId: string, url: string, tier?: string, packCount?: number, idempotencyKey: string, exportTargets?: string[] }} input
   */
  async submitJob(input) {
    if (!this.config.enabled) {
      const e = new Error("ClipCraft is disabled");
      e.code = "CLIPCRAFT_DISABLED";
      throw e;
    }
    if (!input.idempotencyKey?.trim()) {
      const e = new Error("idempotencyKey required");
      e.code = "IDEMPOTENCY_REQUIRED";
      throw e;
    }

    const rl = this.rateLimiter.check(input.userId);
    if (!rl.allowed) {
      const e = new Error("Rate limit exceeded");
      e.code = "RATE_LIMITED";
      e.retryAfterMs = rl.retryAfterMs;
      throw e;
    }

    const cached = this.idempotency.get(input.userId, input.idempotencyKey);
    if (cached) {
      return { ...cached.result, idempotentReplay: true, job: cached.result.job };
    }

    const result = await this.orchestrator.submitJob(input);
    const payload = {
      job: result.job,
      creditsDeducted: result.creditsDeducted,
      transactionId: result.transactionId,
    };
    this.idempotency.set(input.userId, input.idempotencyKey, result.job.id, payload);
    return payload;
  }

  getJob(jobId) {
    return this.orchestrator.getJob(jobId);
  }

  listJobs(userId) {
    return this.orchestrator.store
      .listByUser(userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async drain() {
    await this.orchestrator.drain();
  }
}

/** @returns {ClipCraftRuntime} */
export function getClipCraftRuntime() {
  if (!singleton) singleton = new ClipCraftRuntime();
  return singleton;
}

export function resetClipCraftRuntime() {
  singleton = null;
}
