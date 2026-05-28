// @filename: backend/src/studio/clipcraft/contracts/JobStatusFlow.js

/** @readonly */
export const JobStatusFlow = Object.freeze({
  QUEUED: "queued",
  TRANSCRIBING: "transcribing",
  ANALYZING: "analyzing",
  GENERATING_COPY: "generating_copy",
  RENDERING: "rendering",
  READY: "ready",
  FAILED: "failed",
});

/** @type {readonly string[]} */
export const JOB_STATUS_ORDER = [
  JobStatusFlow.QUEUED,
  JobStatusFlow.TRANSCRIBING,
  JobStatusFlow.ANALYZING,
  JobStatusFlow.GENERATING_COPY,
  JobStatusFlow.RENDERING,
  JobStatusFlow.READY,
];

/** Statuses after which a failed job triggers partial refund policy */
export const REFUND_ELIGIBLE_AFTER = JobStatusFlow.ANALYZING;

/** @type {readonly string[]} */
export const TERMINAL_STATUSES = [JobStatusFlow.READY, JobStatusFlow.FAILED];
