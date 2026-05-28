// @filename: backend/src/studio/clipcraft/registry/bootstrapOrchestrator.js

import { bootstrapClipCraftMocks } from "./bootstrapMocks.js";
import { JobOrchestrator } from "../orchestrator/JobOrchestrator.js";
import { JobStore } from "../orchestrator/JobStore.js";

/**
 * @param {{ store?: JobStore, defaultCredits?: number }} [opts]
 */
export function createClipCraftOrchestrator(opts = {}) {
  const registry = bootstrapClipCraftMocks(undefined, {
    defaultCredits: opts.defaultCredits ?? 100,
  });
  const store = opts.store ?? new JobStore();
  const orchestrator = new JobOrchestrator(registry, store);
  return { registry, store, orchestrator };
}
