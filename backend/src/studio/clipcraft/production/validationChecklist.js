// @filename: backend/src/studio/clipcraft/production/validationChecklist.js

export const PRODUCTION_VALIDATION_CHECKLIST = [
  { id: "env", item: "CLIPCRAFT_ENABLED and provider keys set for live mode", required: true },
  { id: "health", item: "GET /api/studio/clipcraft/health returns ok:true when up", required: true },
  { id: "state", item: "Invalid job status transitions rejected by state machine", required: true },
  { id: "credits", item: "Insufficient balance rejects submit before queue", required: true },
  { id: "idempotency", item: "Duplicate Idempotency-Key returns same job without double charge", required: true },
  { id: "rate", item: "Rate limit returns 429 when exceeded per user", required: true },
  { id: "refund", item: "Failure after analyzing triggers full credit refund", required: true },
  { id: "drain", item: "SIGTERM drains in-flight jobs before process exit", required: true },
  { id: "concurrency", item: "activeJobs never exceeds CLIPCRAFT_MAX_CONCURRENT_JOBS", required: true },
  { id: "timeout", item: "Pipeline stages respect CLIPCRAFT_JOB_TIMEOUT_MS", required: true },
  { id: "tests", item: "npm run clipcraft:test passes all suites", required: true },
  { id: "cli", item: "npm run clipcraft:run completes E2E with mock providers", required: false },
  { id: "docker", item: "Container healthcheck passes within start_period", required: false },
  { id: "secrets", item: "API keys only in env/secrets manager, not in repo", required: true },
  { id: "persist", item: "JobStore + ledger backed by DB/Redis in production deploy", required: false },
];

export function exportChecklistJson() {
  return JSON.stringify({ checklist: PRODUCTION_VALIDATION_CHECKLIST }, null, 2);
}
