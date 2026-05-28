// @filename: backend/src/studio/clipcraft/mocks/MockSchedulerProvider.js

import { asSchedulerProvider } from "../interfaces/ISchedulerProvider.js";

/** @type {Map<string, object>} */
const schedules = new Map();

export function createMockSchedulerProvider() {
  return asSchedulerProvider({
    async schedulePublish({ renderId, platform, runAt, caption, hashtags }) {
      const scheduleId = `sched-${renderId}-${Date.now()}`;
      const ref = { scheduleId, renderId, runAt, platform, caption, hashtags, status: "scheduled" };
      schedules.set(scheduleId, ref);
      return ref;
    },
    async cancelSchedule(scheduleId) {
      const existed = schedules.delete(scheduleId);
      return { cancelled: existed };
    },
  });
}

export function resetMockSchedulerStore() {
  schedules.clear();
}
