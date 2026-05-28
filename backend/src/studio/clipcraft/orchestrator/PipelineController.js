// @filename: backend/src/studio/clipcraft/orchestrator/PipelineController.js

import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import { applyTransition } from "../state/JobStateMachine.js";
import { RegistryKeys } from "../registry/ServiceRegistry.js";
import { shouldRefundOnFailure } from "../services/refundPolicy.js";
import { withRetry, withTimeout } from "./retry.js";

export class PipelineController {
  /**
   * @param {import('../registry/ServiceRegistry.js').ServiceRegistry} registry
   * @param {import('../config/schema.js').ClipCraftConfig} config
   */
  constructor(registry, config) {
    this.registry = registry;
    this.config = config;
    this.url = registry.resolve(RegistryKeys.URL_INGESTION);
    this.transcript = registry.resolve(RegistryKeys.TRANSCRIPT);
    this.analyzer = registry.resolve(RegistryKeys.SEGMENT_ANALYZER);
    this.copyGen = registry.resolve(RegistryKeys.COPY_GENERATOR);
    this.export = registry.resolve(RegistryKeys.EXPORT);
    this.scheduler = registry.resolve(RegistryKeys.SCHEDULER);
    this.credits = registry.resolve(RegistryKeys.CREDITS);
    this.progress = registry.resolve(RegistryKeys.PROGRESS);
  }

  async emit(job, meta = {}) {
    await this.progress.emit({
      jobId: job.id,
      status: job.status,
      progressPercent: job.progressPercent,
      timestamp: new Date().toISOString(),
      meta,
    });
  }

  /**
   * @param {import('../contracts/schemas.js').ClipJob} job
   * @param {string[]} [exportTargets]
   */
  async run(job, exportTargets = ["shorts", "reels", "tiktok"]) {
    const timeoutMs = this.config.jobTimeoutMs;
    const retryOpts = { maxRetries: this.config.maxRetries, backoffMs: this.config.retryBackoffMs };

    try {
      applyTransition(job, JobStatusFlow.TRANSCRIBING);
      await this.emit(job, { stage: "transcribing" });
      const meta = await withTimeout(
        () => withRetry(() => this.url.normalizeUrl(job.url), retryOpts),
        timeoutMs,
        "url"
      );
      job.videoId = meta.videoId;

      const tr = await withTimeout(
        () =>
          withRetry(
            () =>
              this.transcript.fetchTranscript({
                videoId: meta.videoId,
                platform: meta.platform,
                url: meta.canonicalUrl,
              }),
            retryOpts
          ),
        timeoutMs,
        "transcript"
      );
      job._transcript = tr;

      applyTransition(job, JobStatusFlow.ANALYZING);
      await this.emit(job, { stage: "analyzing" });
      const packCount = Math.min(20, Math.max(1, Math.floor(Number(job.packCount) || 1)));
      const analysis = await withTimeout(
        () =>
          withRetry(
            () =>
              this.analyzer.analyzeSegments({
                transcript: tr,
                maxSegments: packCount,
              }),
            retryOpts
          ),
        timeoutMs,
        "analyze"
      );

      applyTransition(job, JobStatusFlow.GENERATING_COPY);
      await this.emit(job, { stage: "generating_copy" });
      const copy = await withTimeout(
        () =>
          withRetry(
            () => this.copyGen.generateCopy({ segments: analysis.segments, tier: job.tier }),
            retryOpts
          ),
        timeoutMs,
        "copy"
      );

      job.segments = analysis.segments.map((seg) => {
        const c = copy.segments.find((x) => x.segmentId === seg.id);
        return {
          id: seg.id,
          startTs: seg.startTs,
          endTs: seg.endTs,
          duration: seg.duration,
          engagementScore: seg.engagementScore,
          sentimentLabel: seg.sentimentLabel,
          hooks: c?.hooks ?? [],
          caption: c?.caption ?? "",
          hashtags: c?.hashtags ?? [],
          isViralOptimized: c?.isViralOptimized ?? false,
        };
      });

      applyTransition(job, JobStatusFlow.RENDERING);
      await this.emit(job, { stage: "rendering" });
      const renders = await withTimeout(
        () => withRetry(() => this.export.queueRender({ job, targets: exportTargets }), retryOpts),
        timeoutMs,
        "render"
      );
      job._renders = renders;

      applyTransition(job, JobStatusFlow.READY);
      await this.emit(job, { stage: "ready", renders });
      delete job._transcript;
      return job;
    } catch (e) {
      job.failedAtStage = job.status;
      await this.fail(job, e);
      throw e;
    }
  }

  /** @param {import('../contracts/schemas.js').ClipJob} job */
  async fail(job, error) {
    const failedAt = job.failedAtStage || job.status;
    applyTransition(job, JobStatusFlow.FAILED, {
      error: error?.message || String(error),
      retryable: true,
    });
    await this.emit(job, { stage: "failed", failedAt });

    if (job.userId && shouldRefundOnFailure(failedAt, job.creditsCost)) {
      await this.credits.refund({
        userId: job.userId,
        amount: job.creditsCost,
        jobId: job.id,
        reason: `failed_at_${failedAt}`,
      });
    }
  }
}
