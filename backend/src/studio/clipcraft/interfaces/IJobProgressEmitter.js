// @filename: backend/src/studio/clipcraft/interfaces/IJobProgressEmitter.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["emit", "subscribe"];

/**
 * @typedef {Object} ProgressEvent
 * @property {string} jobId
 * @property {string} status
 * @property {number} progressPercent
 * @property {string} timestamp
 * @property {Record<string, unknown>} [meta]
 */

/** @returns {object} */
export function IJobProgressEmitterContract() {
  return createContract("IJobProgressEmitter", METHODS);
}

/** @param {object} impl */
export function asJobProgressEmitter(impl) {
  return validateImplementation(impl, "IJobProgressEmitter", METHODS);
}

/**
 * @typedef {Object} IJobProgressEmitter
 * @property {(event: ProgressEvent) => Promise<void>} emit
 * @property {(jobId: string, handler: (event: ProgressEvent) => void) => () => void} subscribe
 */

export const IJobProgressEmitterMethods = METHODS;
