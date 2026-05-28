// @filename: backend/src/studio/clipcraft/scripts/phase1-smoke.mjs
/** Phase 1 smoke: state machine + config load (no external APIs) */
import {
  JobStatusFlow,
  createEmptyClipJob,
  assertClipJob,
  calculateClipJobCredits,
} from "../index.js";
import {
  canTransition,
  applyTransition,
  assertTransition,
  InvalidJobTransitionError,
} from "../state/JobStateMachine.js";
import { loadClipCraftConfig } from "../config/loadConfig.js";

const job = createEmptyClipJob({ id: "smoke-1", url: "https://youtube.com/watch?v=dQw4w9WgXcQ" });
applyTransition(job, JobStatusFlow.TRANSCRIBING);
applyTransition(job, JobStatusFlow.ANALYZING);
assertClipJob(job);

let blocked = false;
try {
  assertTransition(JobStatusFlow.ANALYZING, JobStatusFlow.READY);
} catch (e) {
  blocked = e instanceof InvalidJobTransitionError;
}
if (!blocked) throw new Error("Expected invalid transition to throw");

const cost = calculateClipJobCredits(10, "viral");
const cfg = loadClipCraftConfig({ force: true });
console.log(JSON.stringify({ ok: true, status: job.status, cost, providerMode: cfg.providerMode }, null, 2));
