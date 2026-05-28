// @filename: backend/src/studio/clipcraft/integration/runE2E.js

import { createClipCraftOrchestrator } from "../registry/bootstrapOrchestrator.js";
import { createPollAdapter } from "../orchestrator/adapters/PollAdapter.js";
import { RegistryKeys } from "../registry/ServiceRegistry.js";
import { getProgressHistory } from "../mocks/MemoryJobProgressEmitter.js";
import crypto from "crypto";

/**
 * @param {{
 *   urls: string[],
 *   tier?: "standard"|"viral",
 *   packCount?: number,
 *   userId?: string,
 *   timeoutMs?: number,
 *   pollMs?: number,
 *   initialCredits?: number,
 * }} opts
 */
export async function runClipCraftE2E(opts) {
  const userId = opts.userId ?? "cli-user";
  const { orchestrator, store, registry } = createClipCraftOrchestrator({
    defaultCredits: opts.initialCredits ?? 200,
  });
  const poll = createPollAdapter(orchestrator);
  const credits = registry.resolve(RegistryKeys.CREDITS);

  const balanceBefore = await credits.getBalance(userId);
  const jobs = [];

  for (const url of opts.urls) {
    const idem = `cli-${crypto.randomBytes(4).toString("hex")}`;
    const submitted = await orchestrator.submitJob({
      userId,
      url,
      tier: opts.tier ?? "standard",
      packCount: opts.packCount ?? 1,
      idempotencyKey: idem,
    });

    const final = await poll.waitUntilDone(submitted.job.id, {
      intervalMs: opts.pollMs ?? 150,
      timeoutMs: opts.timeoutMs ?? 120_000,
    });

    jobs.push({
      jobId: submitted.job.id,
      url,
      status: final.status,
      progressPercent: final.progressPercent,
      creditsCost: submitted.job.creditsCost,
      segmentCount: final.segments?.length ?? 0,
      segments: final.segments,
      error: final.error,
      progressEvents: getProgressHistory(submitted.job.id).length,
      transactionId: submitted.transactionId,
    });
  }

  await orchestrator.drain();
  const balanceAfter = await credits.getBalance(userId);

  return {
    ok: jobs.every((j) => j.status === "ready"),
    userId,
    tier: opts.tier ?? "standard",
    packCount: opts.packCount ?? 1,
    jobs,
    credits: {
      before: balanceBefore.balance,
      after: balanceAfter.balance,
      spent: Math.round((balanceBefore.balance - balanceAfter.balance) * 1000) / 1000,
    },
    transactionLog: balanceAfter.transactions,
    storeSize: store.listByUser(userId).length,
  };
}
