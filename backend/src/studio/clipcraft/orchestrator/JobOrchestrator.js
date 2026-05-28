// @filename: backend/src/studio/clipcraft/orchestrator/JobOrchestrator.js

import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import { applyTransition } from "../state/JobStateMachine.js";
import { RegistryKeys } from "../registry/ServiceRegistry.js";
import { PipelineController } from "./PipelineController.js";
import { JobStore } from "./JobStore.js";

export class JobOrchestrator {
  /**
   * @param {import('../registry/ServiceRegistry.js').ServiceRegistry} registry
   * @param {import('./JobStore.js').JobStore} [store]
   */
  constructor(registry, store = new JobStore()) {
    this.registry = registry;
    this.config = registry.getConfig();
    this.store = store;
    this.pipeline = new PipelineController(registry, this.config);
    this.queue = registry.resolve(RegistryKeys.JOB_QUEUE);
    this.credits = registry.resolve(RegistryKeys.CREDITS);
  }

  #active = 0;
  #webhooks = [];
  #draining = false;
  #workerTimer = null;

  onWebhook(handler) {
    this.#webhooks.push(handler);
    return () => {
      this.#webhooks = this.#webhooks.filter((h) => h !== handler);
    };
  }

  #notify(payload) {
    for (const h of this.#webhooks) {
      try {
        h(payload);
      } catch {
        /* ignore webhook errors */
      }
    }
  }

  /**
   * @param {{ userId: string, url: string, tier?: "standard"|"viral", packCount?: number, idempotencyKey: string, exportTargets?: string[] }} input
   */
  async submitJob(input) {
    const tier = input.tier ?? "standard";
    const packCount = input.packCount ?? 1;
    const cost = this.credits.calculateCost({ packCount, tier });

    const job = this.store.create({
      url: input.url,
      userId: input.userId,
      tier,
      packCount,
      creditsCost: cost,
      status: JobStatusFlow.QUEUED,
    });

    const deduct = await this.credits.deductAtomic({
      userId: input.userId,
      amount: cost,
      jobId: job.id,
      idempotencyKey: input.idempotencyKey,
    });
    if (!deduct.ok) {
      applyTransition(job, JobStatusFlow.FAILED, { error: deduct.error, retryable: false });
      this.store.save(job);
      const err = new Error(deduct.error || "Insufficient credits");
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }

    await this.queue.enqueue(job.id, { idempotencyKey: input.idempotencyKey });
    this.store.save(job);
    await this.pipeline.emit(job, { submitted: true });

    setImmediate(() => this.#tick(input.exportTargets).catch(() => {}));
    return { job, creditsDeducted: cost, transactionId: deduct.transactionId };
  }

  getJob(jobId) {
    return this.store.get(jobId);
  }

  getStats() {
    return {
      activeJobs: this.#active,
      draining: this.#draining,
      workerRunning: this.#workerTimer != null,
    };
  }

  async #tick(exportTargets) {
    if (this.#draining) return;
    if (this.#active >= this.config.maxConcurrentJobs) return;

    const msg = await this.queue.peek();
    if (!msg) return;

    this.#active += 1;
    try {
      const job = this.store.get(msg.jobId);
      if (!job || job.status !== JobStatusFlow.QUEUED) {
        await this.queue.ack(msg.messageId);
        return;
      }
      applyTransition(job, JobStatusFlow.QUEUED);
      this.store.save(job);
      await this.pipeline.run(job, exportTargets);
      this.store.save(job);
      await this.queue.ack(msg.messageId);
      this.#notify({ event: job.status === JobStatusFlow.READY ? "job.ready" : "job.failed", job });
    } catch (e) {
      const job = this.store.get(msg.jobId);
      if (job) {
        this.store.save(job);
        this.#notify({ event: "job.failed", job, error: e.message });
      }
      if ((msg.attempt || 1) < this.config.maxRetries) {
        await this.queue.nack(msg.messageId, e.message);
        await this.queue.enqueue(msg.jobId, {
          delayMs: this.config.retryBackoffMs * (msg.attempt || 1),
          idempotencyKey: `retry-${msg.jobId}-${msg.attempt}`,
        });
      } else {
        await this.queue.ack(msg.messageId);
      }
    } finally {
      this.#active -= 1;
      if (!this.#draining) setImmediate(() => this.#tick(exportTargets).catch(() => {}));
    }
  }

  startWorker(intervalMs = 500) {
    if (this.#workerTimer) return;
    this.#workerTimer = setInterval(() => this.#tick().catch(() => {}), intervalMs);
  }

  stopWorker() {
    if (this.#workerTimer) clearInterval(this.#workerTimer);
    this.#workerTimer = null;
  }

  async drain() {
    this.#draining = true;
    this.stopWorker();
    while (this.#active > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
