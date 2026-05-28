// @filename: backend/src/studio/clipcraft/registry/bootstrapMocks.js

import { loadClipCraftConfig } from "../config/loadConfig.js";
import { ServiceRegistry, RegistryKeys, getClipCraftRegistry, resetClipCraftRegistry } from "./ServiceRegistry.js";

export { RegistryKeys };
import { createMockUrlIngestion } from "../mocks/MockUrlIngestion.js";
import { createMockTranscriptProvider } from "../mocks/MockTranscriptProvider.js";
import { createMockSegmentAnalyzer } from "../mocks/MockSegmentAnalyzer.js";
import { createMockCopyGenerator } from "../mocks/MockCopyGenerator.js";
import { createMockExportProvider } from "../mocks/MockExportProvider.js";
import { createMockSchedulerProvider } from "../mocks/MockSchedulerProvider.js";
import { createMemoryJobQueue } from "../mocks/MemoryJobQueue.js";
import { createMemoryJobProgressEmitter } from "../mocks/MemoryJobProgressEmitter.js";
import { createCreditsBillingEngine } from "../services/CreditsBillingEngine.js";

/**
 * Register all mock implementations on the ClipCraft DI registry.
 * @param {ServiceRegistry} [registry]
 * @param {{ forceConfig?: boolean, defaultCredits?: number }} [opts]
 */
export function bootstrapClipCraftMocks(registry, opts = {}) {
  const reg = registry ?? getClipCraftRegistry();
  const config = loadClipCraftConfig({ force: opts.forceConfig ?? false });

  reg.setConfig(config);
  reg.register(RegistryKeys.URL_INGESTION, createMockUrlIngestion());
  reg.register(RegistryKeys.TRANSCRIPT, createMockTranscriptProvider());
  reg.register(RegistryKeys.SEGMENT_ANALYZER, createMockSegmentAnalyzer());
  reg.register(RegistryKeys.COPY_GENERATOR, createMockCopyGenerator());
  reg.register(RegistryKeys.EXPORT, createMockExportProvider());
  reg.register(RegistryKeys.SCHEDULER, createMockSchedulerProvider());
  reg.register(RegistryKeys.JOB_QUEUE, createMemoryJobQueue());
  reg.register(RegistryKeys.PROGRESS, createMemoryJobProgressEmitter());
  reg.register(
    RegistryKeys.CREDITS,
    createCreditsBillingEngine(config, { defaultBalance: opts.defaultCredits ?? 100 })
  );

  return reg;
}

export async function resetClipCraftMocks() {
  resetClipCraftRegistry();
  const { resetCreditsLedger } = await import("../services/CreditsBillingEngine.js");
  const { resetMockExportStore } = await import("../mocks/MockExportProvider.js");
  const { resetMockSchedulerStore } = await import("../mocks/MockSchedulerProvider.js");
  const { resetMemoryJobQueue } = await import("../mocks/MemoryJobQueue.js");
  const { resetMemoryProgress } = await import("../mocks/MemoryJobProgressEmitter.js");
  resetCreditsLedger();
  resetMockExportStore();
  resetMockSchedulerStore();
  resetMemoryJobQueue();
  resetMemoryProgress();
}
