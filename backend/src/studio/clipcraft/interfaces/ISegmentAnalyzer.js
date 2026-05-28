// @filename: backend/src/studio/clipcraft/interfaces/ISegmentAnalyzer.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["analyzeSegments"];

/**
 * @typedef {Object} SegmentCandidate
 * @property {string} id
 * @property {number} startTs
 * @property {number} endTs
 * @property {number} duration
 * @property {number} engagementScore
 * @property {string} sentimentLabel
 * @property {number} confidence
 * @property {string} [rationale]
 * @property {string} [sourceText] transcript excerpt for copy generation
 */

/**
 * @typedef {Object} SegmentAnalysisResult
 * @property {SegmentCandidate[]} segments
 * @property {Record<string, unknown>} [analyzerMeta]
 */

/** @returns {object} */
export function ISegmentAnalyzerContract() {
  return createContract("ISegmentAnalyzer", METHODS);
}

/** @param {object} impl */
export function asSegmentAnalyzer(impl) {
  return validateImplementation(impl, "ISegmentAnalyzer", METHODS);
}

/**
 * @typedef {Object} ISegmentAnalyzer
 * @property {(input: { transcript: import('./ITranscriptProvider.js').TranscriptResult, maxSegments?: number, targetDurationSec?: [number, number] }) => Promise<SegmentAnalysisResult>} analyzeSegments
 */

export const ISegmentAnalyzerMethods = METHODS;
