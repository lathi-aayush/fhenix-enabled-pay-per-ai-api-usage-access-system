// @filename: backend/src/studio/clipcraft/interfaces/ISchedulerProvider.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = ["schedulePublish", "cancelSchedule"];

/**
 * @typedef {Object} ScheduledPublishRef
 * @property {string} scheduleId
 * @property {string} renderId
 * @property {string} runAt
 * @property {string} platform
 */

/** @returns {object} */
export function ISchedulerProviderContract() {
  return createContract("ISchedulerProvider", METHODS);
}

/** @param {object} impl */
export function asSchedulerProvider(impl) {
  return validateImplementation(impl, "ISchedulerProvider", METHODS);
}

/**
 * @typedef {Object} ISchedulerProvider
 * @property {(input: { renderId: string, platform: string, runAt: string, caption: string, hashtags: string[] }) => Promise<ScheduledPublishRef>} schedulePublish
 * @property {(scheduleId: string) => Promise<{ cancelled: boolean }>} cancelSchedule
 */

export const ISchedulerProviderMethods = METHODS;
