// @filename: backend/src/studio/clipcraft/config/loadConfig.js

import { buildConfigFromEnv, validateConfig } from "./schema.js";

let cached = null;

/**
 * @param {{ force?: boolean, env?: Record<string, string> }} [opts]
 * @returns {import('./schema.js').ClipCraftConfig}
 */
export function loadClipCraftConfig(opts = {}) {
  if (cached && !opts.force) return cached;
  const config = validateConfig(buildConfigFromEnv(opts.env ?? process.env));
  cached = config;
  return config;
}

export function resetClipCraftConfigCache() {
  cached = null;
}
