// @filename: backend/src/studio/clipcraft/interfaces/IJobQueue.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["enqueue", "ack", "nack", "peek"];

/**
 * @typedef {Object} QueueMessage
 * @property {string} messageId
 * @property {string} jobId
 * @property {number} attempt
 * @property {string} enqueuedAt
 */

/** @returns {object} */
export function IJobQueueContract() {
  return createContract("IJobQueue", METHODS);
}

/** @param {object} impl */
export function asJobQueue(impl) {
  return validateImplementation(impl, "IJobQueue", METHODS);
}

/**
 * @typedef {Object} IJobQueue
 * @property {(jobId: string, opts?: { delayMs?: number, idempotencyKey?: string }) => Promise<QueueMessage>} enqueue
 * @property {(messageId: string) => Promise<void>} ack
 * @property {(messageId: string, reason?: string) => Promise<void>} nack
 * @property {() => Promise<QueueMessage|null>} peek
 */

export const IJobQueueMethods = METHODS;
