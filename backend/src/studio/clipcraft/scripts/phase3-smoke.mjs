// @filename: backend/src/studio/clipcraft/scripts/phase3-smoke.mjs
import { createClipCraftOrchestrator } from "../registry/bootstrapOrchestrator.js";
import { createPollAdapter } from "../orchestrator/adapters/PollAdapter.js";
import { createWebhookAdapter } from "../orchestrator/adapters/WebhookAdapter.js";
import { getProgressHistory } from "../mocks/MemoryJobProgressEmitter.js";
import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import { RegistryKeys } from "../registry/ServiceRegistry.js";

const { orchestrator, registry } = createClipCraftOrchestrator({ defaultCredits: 50 });
const poll = createPollAdapter(orchestrator);
const webhook = createWebhookAdapter(orchestrator);

const { job } = await orchestrator.submitJob({
  userId: "user-p3",
  url: "https://youtu.be/dQw4w9WgXcQ",
  tier: "viral",
  packCount: 1,
  idempotencyKey: "submit-p3-1",
});

const final = await poll.waitUntilDone(job.id, { intervalMs: 100, timeoutMs: 30_000 });
const events = getProgressHistory(job.id);
const credits = registry.resolve(RegistryKeys.CREDITS);
const bal = await credits.getBalance("user-p3");

console.log(
  JSON.stringify(
    {
      ok: final.status === JobStatusFlow.READY,
      jobId: job.id,
      status: final.status,
      segmentCount: final.segments?.length ?? 0,
      progressEvents: events.length,
      webhookDeliveries: webhook.deliveries.length,
      balance: bal.balance,
    },
    null,
    2
  )
);

await orchestrator.drain();
