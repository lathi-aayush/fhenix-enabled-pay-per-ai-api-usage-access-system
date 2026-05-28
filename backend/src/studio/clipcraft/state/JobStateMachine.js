// @filename: backend/src/studio/clipcraft/state/JobStateMachine.js

import { JobStatusFlow, TERMINAL_STATUSES } from "../contracts/JobStatusFlow.js";

/** @type {Record<string, readonly string[]>} */
const ALLOWED_TRANSITIONS = Object.freeze({
  [JobStatusFlow.QUEUED]: [JobStatusFlow.TRANSCRIBING, JobStatusFlow.FAILED],
  [JobStatusFlow.TRANSCRIBING]: [JobStatusFlow.ANALYZING, JobStatusFlow.FAILED],
  [JobStatusFlow.ANALYZING]: [JobStatusFlow.GENERATING_COPY, JobStatusFlow.FAILED],
  [JobStatusFlow.GENERATING_COPY]: [JobStatusFlow.RENDERING, JobStatusFlow.FAILED],
  [JobStatusFlow.RENDERING]: [JobStatusFlow.READY, JobStatusFlow.FAILED],
  [JobStatusFlow.FAILED]: [JobStatusFlow.QUEUED],
  [JobStatusFlow.READY]: [],
});

/** Progress percent hints per status (for emitters) */
export const STATUS_PROGRESS_MAP = Object.freeze({
  [JobStatusFlow.QUEUED]: 0,
  [JobStatusFlow.TRANSCRIBING]: 15,
  [JobStatusFlow.ANALYZING]: 35,
  [JobStatusFlow.GENERATING_COPY]: 55,
  [JobStatusFlow.RENDERING]: 80,
  [JobStatusFlow.READY]: 100,
  [JobStatusFlow.FAILED]: 0,
});

export class InvalidJobTransitionError extends Error {
  /** @param {string} from @param {string} to */
  constructor(from, to) {
    super(`Invalid ClipJob transition: ${from} → ${to}`);
    this.name = "InvalidJobTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * @param {string} current
 * @param {string} next
 */
export function canTransition(current, next) {
  if (current === next) return true;
  const allowed = ALLOWED_TRANSITIONS[current];
  return Array.isArray(allowed) && allowed.includes(next);
}

/**
 * @param {string} current
 * @param {string} next
 * @returns {string}
 */
export function assertTransition(current, next) {
  if (!canTransition(current, next)) {
    throw new InvalidJobTransitionError(current, next);
  }
  return next;
}

/**
 * Apply transition to a ClipJob-shaped object (mutates status, updatedAt, progress).
 * @param {import('../contracts/schemas.js').ClipJob} job
 * @param {string} nextStatus
 * @param {{ error?: string, retryable?: boolean }} [opts]
 */
export function applyTransition(job, nextStatus, opts = {}) {
  assertTransition(job.status, nextStatus);
  job.status = nextStatus;
  job.updatedAt = new Date().toISOString();
  job.progressPercent = STATUS_PROGRESS_MAP[nextStatus] ?? job.progressPercent;
  if (nextStatus === JobStatusFlow.FAILED) {
    job.error = opts.error ?? job.error ?? "Job failed";
    job.retryable = opts.retryable ?? true;
  } else if (nextStatus === JobStatusFlow.READY) {
    job.error = undefined;
    job.retryable = false;
  }
  return job;
}

/** @param {string} status */
export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/** Ordered pipeline stages (excludes failed/ready terminal paths) */
export function nextPipelineStage(current) {
  const pipeline = [
    JobStatusFlow.QUEUED,
    JobStatusFlow.TRANSCRIBING,
    JobStatusFlow.ANALYZING,
    JobStatusFlow.GENERATING_COPY,
    JobStatusFlow.RENDERING,
    JobStatusFlow.READY,
  ];
  const idx = pipeline.indexOf(current);
  return idx >= 0 && idx < pipeline.length - 1 ? pipeline[idx + 1] : null;
}
