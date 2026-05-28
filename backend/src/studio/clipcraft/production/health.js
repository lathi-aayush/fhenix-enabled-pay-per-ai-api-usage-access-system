// @filename: backend/src/studio/clipcraft/production/health.js

import { loadClipCraftConfig } from "../config/loadConfig.js";

/**
 * @param {import('./ClipCraftRuntime.js').ClipCraftRuntime} [runtime]
 */
export function getClipCraftHealth(runtime) {
  let config;
  try {
    config = loadClipCraftConfig();
  } catch (e) {
    return { ok: false, service: "clipcraft", error: e.message };
  }

  if (!config.enabled) {
    return { ok: true, service: "clipcraft", status: "disabled" };
  }

  const stats = runtime?.getStats?.() ?? {};
  const healthy = !stats.draining && stats.activeJobs <= config.maxConcurrentJobs;

  return {
    ok: healthy,
    service: "clipcraft",
    status: stats.draining ? "draining" : healthy ? "up" : "degraded",
    providerMode: config.providerMode,
    maxConcurrentJobs: config.maxConcurrentJobs,
    activeJobs: stats.activeJobs ?? 0,
    draining: stats.draining ?? false,
    workerRunning: stats.workerRunning ?? false,
    idempotencyEntries: stats.idempotencyEntries ?? 0,
    uptimeMs: stats.uptimeMs ?? 0,
    timestamp: new Date().toISOString(),
  };
}
