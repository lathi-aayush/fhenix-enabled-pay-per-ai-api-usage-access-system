// @filename: backend/src/studio/clipcraft/interfaces/IUrlIngestion.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["normalizeUrl", "extractMetadata"];

/**
 * URL Ingestion Service contract.
 * Validates & normalizes YouTube/Twitch URLs; extracts video id + metadata.
 *
 * @typedef {Object} IngestedVideo
 * @property {string} canonicalUrl
 * @property {"youtube"|"twitch"|"unknown"} platform
 * @property {string} videoId
 * @property {string} [title]
 * @property {number} [durationSec]
 * @property {string} [channelId]
 * @property {Record<string, unknown>} [raw]
 */

/** @returns {import('./createContract.js').ContractStub} */
export function IUrlIngestionContract() {
  return createContract("IUrlIngestion", METHODS);
}

/**
 * @param {object} impl
 * @returns {IUrlIngestion}
 */
export function asUrlIngestion(impl) {
  return validateImplementation(impl, "IUrlIngestion", METHODS);
}

/**
 * @typedef {Object} IUrlIngestion
 * @property {(url: string) => Promise<IngestedVideo>} normalizeUrl
 * @property {(url: string) => Promise<IngestedVideo>} extractMetadata
 */

export const IUrlIngestionMethods = METHODS;
