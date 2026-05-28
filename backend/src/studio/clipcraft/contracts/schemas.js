// @filename: backend/src/studio/clipcraft/contracts/schemas.js

import { JobStatusFlow } from "./JobStatusFlow.js";

/**
 * @typedef {Object} ClipSegment
 * @property {string} id
 * @property {number} startTs
 * @property {number} endTs
 * @property {number} duration
 * @property {number} engagementScore
 * @property {string} sentimentLabel
 * @property {string[]} hooks
 * @property {string} caption
 * @property {string[]} hashtags
 * @property {boolean} isViralOptimized
 */

/**
 * @typedef {Object} ClipJob
 * @property {string} id
 * @property {string} url
 * @property {string} status
 * @property {number} creditsCost
 * @property {"standard"|"viral"} tier
 * @property {number} [packCount]
 * @property {ClipSegment[]} segments
 * @property {number} progressPercent
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [error]
 * @property {string} [userId]
 * @property {string} [videoId]
 * @property {boolean} [retryable]
 */

/**
 * @typedef {"deduct"|"refund"|"topup"} CreditTransactionType
 */

/**
 * @typedef {Object} CreditTransaction
 * @property {string} id
 * @property {number} amount
 * @property {CreditTransactionType} type
 * @property {string} [jobId]
 * @property {string} createdAt
 * @property {"pending"|"committed"|"reversed"} status
 */

/**
 * @typedef {Object} UserCredits
 * @property {string} userId
 * @property {number} balance
 * @property {CreditTransaction[]} transactions
 */

export function assertClipSegment(seg) {
  if (!seg || typeof seg.id !== "string") throw new TypeError("ClipSegment.id required");
  if (typeof seg.startTs !== "number" || typeof seg.endTs !== "number") {
    throw new TypeError("ClipSegment timestamps required");
  }
  if (seg.endTs <= seg.startTs) throw new TypeError("ClipSegment endTs must exceed startTs");
  return true;
}

export function assertClipJob(job) {
  if (!job || typeof job.id !== "string") throw new TypeError("ClipJob.id required");
  if (typeof job.url !== "string" || !job.url.trim()) throw new TypeError("ClipJob.url required");
  if (!Object.values(JobStatusFlow).includes(job.status)) {
    throw new TypeError(`ClipJob.status invalid: ${job.status}`);
  }
  if (typeof job.creditsCost !== "number" || job.creditsCost < 0) {
    throw new TypeError("ClipJob.creditsCost invalid");
  }
  if (!["standard", "viral"].includes(job.tier)) throw new TypeError("ClipJob.tier invalid");
  if (!Array.isArray(job.segments)) throw new TypeError("ClipJob.segments must be array");
  return true;
}

export function createEmptyClipJob(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? "",
    url: partial.url ?? "",
    status: partial.status ?? JobStatusFlow.QUEUED,
    creditsCost: partial.creditsCost ?? 0,
    tier: partial.tier ?? "standard",
    packCount: partial.packCount ?? 1,
    segments: partial.segments ?? [],
    progressPercent: partial.progressPercent ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    error: partial.error,
    userId: partial.userId,
    videoId: partial.videoId,
    retryable: partial.retryable ?? false,
  };
}
