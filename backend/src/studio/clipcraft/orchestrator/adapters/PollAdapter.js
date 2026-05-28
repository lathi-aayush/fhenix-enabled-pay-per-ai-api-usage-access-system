// @filename: backend/src/studio/clipcraft/orchestrator/adapters/PollAdapter.js

import { isTerminal } from "../../state/JobStateMachine.js";

/**
 * Polling adapter for job status (no webhook required).
 * @param {import('../JobOrchestrator.js').JobOrchestrator} orchestrator
 */
export function createPollAdapter(orchestrator) {
  return {
    getStatus(jobId) {
      const job = orchestrator.getJob(jobId);
      if (!job) return { found: false };
      return {
        found: true,
        jobId: job.id,
        status: job.status,
        progressPercent: job.progressPercent,
        error: job.error,
        segments: job.segments,
        updatedAt: job.updatedAt,
      };
    },

    /**
     * @param {string} jobId
     * @param {{ intervalMs?: number, timeoutMs?: number }} [opts]
     */
    waitUntilDone(jobId, opts = {}) {
      const intervalMs = opts.intervalMs ?? 200;
      const timeoutMs = opts.timeoutMs ?? 120_000;
      const start = Date.now();
      return new Promise((resolve, reject) => {
        const tick = () => {
          const s = this.getStatus(jobId);
          if (!s.found) return reject(new Error("Job not found"));
          if (isTerminal(s.status)) return resolve(s);
          if (Date.now() - start > timeoutMs) {
            return reject(new Error("Poll timeout"));
          }
          setTimeout(tick, intervalMs);
        };
        tick();
      });
    },
  };
}
