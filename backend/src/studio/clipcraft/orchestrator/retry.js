// @filename: backend/src/studio/clipcraft/orchestrator/retry.js

export class PipelineTimeoutError extends Error {
  constructor(stage, ms) {
    super(`Pipeline stage "${stage}" timed out after ${ms}ms`);
    this.name = "PipelineTimeoutError";
    this.stage = stage;
  }
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxRetries: number, backoffMs: number, label?: string }} opts
 */
export async function withRetry(fn, opts) {
  const { maxRetries, backoffMs, label = "operation" } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt >= maxRetries) break;
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error(`${label} failed after retries`);
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} timeoutMs
 * @param {string} stage
 */
export async function withTimeout(fn, timeoutMs, stage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new PipelineTimeoutError(stage, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
