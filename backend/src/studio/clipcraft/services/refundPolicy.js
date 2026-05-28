// @filename: backend/src/studio/clipcraft/services/refundPolicy.js

import { REFUND_ELIGIBLE_AFTER, JobStatusFlow } from "../contracts/JobStatusFlow.js";

const STAGE_ORDER = [
  JobStatusFlow.QUEUED,
  JobStatusFlow.TRANSCRIBING,
  JobStatusFlow.ANALYZING,
  JobStatusFlow.GENERATING_COPY,
  JobStatusFlow.RENDERING,
  JobStatusFlow.READY,
];

/**
 * Refund 100% if job failed after analyzing stage (AI/video costs incurred).
 * @param {string} failedAtStatus
 * @param {number} creditsCost
 */
export function shouldRefundOnFailure(failedAtStatus, creditsCost) {
  if (!creditsCost || creditsCost <= 0) return false;
  const failIdx = STAGE_ORDER.indexOf(failedAtStatus);
  const minIdx = STAGE_ORDER.indexOf(REFUND_ELIGIBLE_AFTER);
  if (failIdx < 0 || minIdx < 0) return false;
  return failIdx >= minIdx;
}
