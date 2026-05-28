// @filename: backend/src/studio/clipcraft/registry/ServiceRegistry.js

/**
 * Dependency injection registry for ClipCraft pipeline services.
 * Phase 2+ registers concrete / mock implementations here.
 */
export class ServiceRegistry {
  constructor() {
    /** @type {Map<string, unknown>} */
    this._services = new Map();
    /** @type {import('../config/schema.js').ClipCraftConfig|null} */
    this._config = null;
  }

  /** @param {import('../config/schema.js').ClipCraftConfig} config */
  setConfig(config) {
    this._config = config;
    return this;
  }

  getConfig() {
    if (!this._config) throw new Error("ServiceRegistry: config not set");
    return this._config;
  }

  /**
   * @param {string} key
   * @param {unknown} impl
   */
  register(key, impl) {
    this._services.set(key, impl);
    return this;
  }

  /**
   * @param {string} key
   */
  resolve(key) {
    if (!this._services.has(key)) {
      throw new Error(`ServiceRegistry: unregistered service "${key}"`);
    }
    return this._services.get(key);
  }

  has(key) {
    return this._services.has(key);
  }

  /** @returns {string[]} */
  keys() {
    return [...this._services.keys()];
  }
}

/** Canonical registry keys */
export const RegistryKeys = Object.freeze({
  URL_INGESTION: "urlIngestion",
  TRANSCRIPT: "transcriptProvider",
  SEGMENT_ANALYZER: "segmentAnalyzer",
  COPY_GENERATOR: "copyGenerator",
  EXPORT: "exportProvider",
  SCHEDULER: "schedulerProvider",
  CREDITS: "creditsBilling",
  JOB_QUEUE: "jobQueue",
  PROGRESS: "jobProgressEmitter",
});

let defaultRegistry = null;

/** @returns {ServiceRegistry} */
export function getClipCraftRegistry() {
  if (!defaultRegistry) defaultRegistry = new ServiceRegistry();
  return defaultRegistry;
}

export function resetClipCraftRegistry() {
  defaultRegistry = null;
}
