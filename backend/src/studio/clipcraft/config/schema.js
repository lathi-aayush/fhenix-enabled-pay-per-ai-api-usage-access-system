// @filename: backend/src/studio/clipcraft/config/schema.js

import { PricingDefaults } from "../contracts/pricing.js";

/**
 * @typedef {Object} ClipCraftConfig
 * @property {boolean} enabled
 * @property {string} providerMode
 * @property {number} maxConcurrentJobs
 * @property {number} jobTimeoutMs
 * @property {number} maxRetries
 * @property {number} retryBackoffMs
 * @property {number} creditsPerPack
 * @property {number} bulkPackThreshold
 * @property {number} bulkPackTotalCredits
 * @property {number} viralSurchargePerPack
 * @property {string} [transcriptProviderUrl]
 * @property {string} [transcriptApiKey]
 * @property {string} [aiAnalyzerUrl]
 * @property {string} [aiAnalyzerApiKey]
 * @property {string} [copyGeneratorUrl]
 * @property {string} [copyGeneratorApiKey]
 * @property {string} [exportProviderUrl]
 * @property {string} [exportApiKey]
 * @property {string} [schedulerProviderUrl]
 * @property {string} [schedulerApiKey]
 * @property {string} [webhookSecret]
 * @property {string} [jobQueueAdapter]
 * @property {string} [progressAdapter]
 */

/** Env key map — abstract; swap providers without code changes */
export const ENV_KEYS = Object.freeze({
  ENABLED: "CLIPCRAFT_ENABLED",
  PROVIDER_MODE: "CLIPCRAFT_PROVIDER_MODE",
  MAX_CONCURRENT_JOBS: "CLIPCRAFT_MAX_CONCURRENT_JOBS",
  JOB_TIMEOUT_MS: "CLIPCRAFT_JOB_TIMEOUT_MS",
  MAX_RETRIES: "CLIPCRAFT_MAX_RETRIES",
  RETRY_BACKOFF_MS: "CLIPCRAFT_RETRY_BACKOFF_MS",
  CREDITS_PER_PACK: "CLIPCRAFT_CREDITS_PER_PACK",
  BULK_PACK_THRESHOLD: "CLIPCRAFT_BULK_PACK_THRESHOLD",
  BULK_PACK_TOTAL_CREDITS: "CLIPCRAFT_BULK_PACK_TOTAL_CREDITS",
  VIRAL_SURCHARGE: "CLIPCRAFT_VIRAL_SURCHARGE_PER_PACK",
  TRANSCRIPT_URL: "CLIPCRAFT_TRANSCRIPT_PROVIDER_URL",
  TRANSCRIPT_KEY: "CLIPCRAFT_TRANSCRIPT_API_KEY",
  AI_ANALYZER_URL: "CLIPCRAFT_AI_ANALYZER_URL",
  AI_ANALYZER_KEY: "CLIPCRAFT_AI_ANALYZER_API_KEY",
  COPY_URL: "CLIPCRAFT_COPY_GENERATOR_URL",
  COPY_KEY: "CLIPCRAFT_COPY_GENERATOR_API_KEY",
  EXPORT_URL: "CLIPCRAFT_EXPORT_PROVIDER_URL",
  EXPORT_KEY: "CLIPCRAFT_EXPORT_API_KEY",
  SCHEDULER_URL: "CLIPCRAFT_SCHEDULER_PROVIDER_URL",
  SCHEDULER_KEY: "CLIPCRAFT_SCHEDULER_API_KEY",
  WEBHOOK_SECRET: "CLIPCRAFT_WEBHOOK_SECRET",
  JOB_QUEUE_ADAPTER: "CLIPCRAFT_JOB_QUEUE_ADAPTER",
  PROGRESS_ADAPTER: "CLIPCRAFT_PROGRESS_ADAPTER",
  RATE_LIMIT_PER_MIN: "CLIPCRAFT_RATE_LIMIT_PER_MIN",
  IDEMPOTENCY_TTL_MS: "CLIPCRAFT_IDEMPOTENCY_TTL_MS",
});

/**
 * @param {Record<string, string|undefined>} env
 * @returns {ClipCraftConfig}
 */
export function buildConfigFromEnv(env = process.env) {
  const num = (key, fallback) => {
    const v = env[key];
    if (v === undefined || v === "") return fallback;
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error(`Invalid numeric env ${key}=${v}`);
    return n;
  };
  const str = (key, fallback = "") => env[key]?.trim() || fallback;

  return {
    enabled: str(ENV_KEYS.ENABLED, "true") !== "false",
    providerMode: str(ENV_KEYS.PROVIDER_MODE, "mock"),
    maxConcurrentJobs: num(ENV_KEYS.MAX_CONCURRENT_JOBS, 4),
    jobTimeoutMs: num(ENV_KEYS.JOB_TIMEOUT_MS, 300_000),
    maxRetries: num(ENV_KEYS.MAX_RETRIES, 3),
    retryBackoffMs: num(ENV_KEYS.RETRY_BACKOFF_MS, 2000),
    creditsPerPack: num(ENV_KEYS.CREDITS_PER_PACK, PricingDefaults.CREDITS_PER_PACK),
    bulkPackThreshold: num(ENV_KEYS.BULK_PACK_THRESHOLD, PricingDefaults.BULK_PACK_THRESHOLD),
    bulkPackTotalCredits: num(ENV_KEYS.BULK_PACK_TOTAL_CREDITS, PricingDefaults.BULK_PACK_TOTAL_CREDITS),
    viralSurchargePerPack: num(ENV_KEYS.VIRAL_SURCHARGE, PricingDefaults.VIRAL_SURCHARGE_PER_PACK),
    transcriptProviderUrl: str(ENV_KEYS.TRANSCRIPT_URL),
    transcriptApiKey: str(ENV_KEYS.TRANSCRIPT_KEY),
    aiAnalyzerUrl: str(ENV_KEYS.AI_ANALYZER_URL),
    aiAnalyzerApiKey: str(ENV_KEYS.AI_ANALYZER_KEY),
    copyGeneratorUrl: str(ENV_KEYS.COPY_URL),
    copyGeneratorApiKey: str(ENV_KEYS.COPY_KEY),
    exportProviderUrl: str(ENV_KEYS.EXPORT_URL),
    exportApiKey: str(ENV_KEYS.EXPORT_KEY),
    schedulerProviderUrl: str(ENV_KEYS.SCHEDULER_URL),
    schedulerApiKey: str(ENV_KEYS.SCHEDULER_KEY),
    webhookSecret: str(ENV_KEYS.WEBHOOK_SECRET),
    jobQueueAdapter: str(ENV_KEYS.JOB_QUEUE_ADAPTER, "memory"),
    progressAdapter: str(ENV_KEYS.PROGRESS_ADAPTER, "memory"),
    rateLimitPerMin: num(ENV_KEYS.RATE_LIMIT_PER_MIN, 30),
    idempotencyTtlMs: num(ENV_KEYS.IDEMPOTENCY_TTL_MS, 86_400_000),
  };
}

/**
 * @param {ClipCraftConfig} config
 */
export function validateConfig(config) {
  if (!config) throw new Error("ClipCraft config missing");
  if (config.maxConcurrentJobs < 1) throw new Error("maxConcurrentJobs must be >= 1");
  if (config.jobTimeoutMs < 10_000) throw new Error("jobTimeoutMs too low");
  if (config.creditsPerPack <= 0) throw new Error("creditsPerPack must be positive");
  if (!["mock", "live", "hybrid"].includes(config.providerMode)) {
    throw new Error(`providerMode invalid: ${config.providerMode}`);
  }
  return config;
}
