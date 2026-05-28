// @filename: backend/src/studio/clipcraft/scripts/phase5-smoke.mjs
import { ClipCraftRuntime, resetClipCraftRuntime } from "../production/ClipCraftRuntime.js";
import { getClipCraftHealth } from "../production/health.js";
import { PRODUCTION_VALIDATION_CHECKLIST } from "../production/validationChecklist.js";
import { createPollAdapter } from "../orchestrator/adapters/PollAdapter.js";

resetClipCraftRuntime();
const runtime = new ClipCraftRuntime({ maxPerMinute: 100 });
runtime.start();

const key = "phase5-idem";
const a = await runtime.submitJob({
  userId: "p5",
  url: "https://youtu.be/dQw4w9WgXcQ",
  tier: "standard",
  packCount: 1,
  idempotencyKey: key,
});
const b = await runtime.submitJob({
  userId: "p5",
  url: "https://youtu.be/dQw4w9WgXcQ",
  tier: "standard",
  packCount: 1,
  idempotencyKey: key,
});

const poll = createPollAdapter(runtime.orchestrator);
await poll.waitUntilDone(a.job.id, { intervalMs: 100, timeoutMs: 30_000 });

const health = getClipCraftHealth(runtime);
await runtime.drain();

console.log(
  JSON.stringify(
    {
      ok: health.ok && a.job.id === b.job.id && b.idempotentReplay === true,
      healthStatus: health.status,
      idempotentReplay: b.idempotentReplay,
      checklistItems: PRODUCTION_VALIDATION_CHECKLIST.length,
    },
    null,
    2
  )
);

process.exit(health.ok ? 0 : 1);
