// @filename: backend/src/studio/clipcraft/interfaces/IExportProvider.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["queueRender", "getRenderStatus"];

/**
 * @typedef {"tiktok"|"reels"|"shorts"} ExportTarget
 */

/**
 * @typedef {Object} RenderJobRef
 * @property {string} renderId
 * @property {string} jobId
 * @property {ExportTarget} target
 * @property {string} status
 */

/** @returns {object} */
export function IExportProviderContract() {
  return createContract("IExportProvider", METHODS);
}

/** @param {object} impl */
export function asExportProvider(impl) {
  return validateImplementation(impl, "IExportProvider", METHODS);
}

/**
 * @typedef {Object} IExportProvider
 * @property {(input: { job: import('../contracts/schemas.js').ClipJob, targets: ExportTarget[] }) => Promise<RenderJobRef[]>} queueRender
 * @property {(renderId: string) => Promise<{ status: string, artifactUrl?: string, error?: string }>} getRenderStatus
 */

export const IExportProviderMethods = METHODS;
