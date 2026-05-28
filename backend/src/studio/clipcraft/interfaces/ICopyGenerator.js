// @filename: backend/src/studio/clipcraft/interfaces/ICopyGenerator.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["generateCopy"];

/**
 * @typedef {Object} SegmentCopy
 * @property {string} segmentId
 * @property {string[]} hooks
 * @property {string} caption
 * @property {string[]} hashtags
 * @property {boolean} isViralOptimized
 */

/**
 * @typedef {Object} CopyGenerationResult
 * @property {SegmentCopy[]} segments
 * @property {Record<string, unknown>} [generatorMeta]
 */

/** @returns {object} */
export function ICopyGeneratorContract() {
  return createContract("ICopyGenerator", METHODS);
}

/** @param {object} impl */
export function asCopyGenerator(impl) {
  return validateImplementation(impl, "ICopyGenerator", METHODS);
}

/**
 * @typedef {Object} ICopyGenerator
 * @property {(input: { segments: import('./ISegmentAnalyzer.js').SegmentCandidate[], tier: "standard"|"viral", platformHints?: string[] }) => Promise<CopyGenerationResult>} generateCopy
 */

export const ICopyGeneratorMethods = METHODS;
