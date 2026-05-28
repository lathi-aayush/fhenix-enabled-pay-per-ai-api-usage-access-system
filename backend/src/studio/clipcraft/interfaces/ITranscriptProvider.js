// @filename: backend/src/studio/clipcraft/interfaces/ITranscriptProvider.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["fetchTranscript"];

/**
 * @typedef {Object} TranscriptCue
 * @property {number} start
 * @property {number} end
 * @property {string} text
 */

/**
 * @typedef {Object} TranscriptResult
 * @property {string} videoId
 * @property {string} language
 * @property {TranscriptCue[]} cues
 * @property {string} fullText
 * @property {Record<string, unknown>} [providerMeta]
 */

/** @returns {object} */
export function ITranscriptProviderContract() {
  return createContract("ITranscriptProvider", METHODS);
}

/** @param {object} impl */
export function asTranscriptProvider(impl) {
  return validateImplementation(impl, "ITranscriptProvider", METHODS);
}

/**
 * @typedef {Object} ITranscriptProvider
 * @property {(input: { videoId: string, platform: string, url: string }) => Promise<TranscriptResult>} fetchTranscript
 */

export const ITranscriptProviderMethods = METHODS;
