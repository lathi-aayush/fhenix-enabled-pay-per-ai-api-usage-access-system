// @filename: backend/src/studio/clipcraft/mocks/MemoryJobProgressEmitter.js

import { asJobProgressEmitter } from "../interfaces/IJobProgressEmitter.js";

/** @type {Map<string, import('../interfaces/IJobProgressEmitter.js').ProgressEvent[]>} */
const history = new Map();
/** @type {Map<string, Set<Function>>} */
const subs = new Map();

export function createMemoryJobProgressEmitter() {
  return asJobProgressEmitter({
    async emit(event) {
      const list = history.get(event.jobId) ?? [];
      list.push(event);
      history.set(event.jobId, list);
      const handlers = subs.get(event.jobId);
      if (handlers) handlers.forEach((h) => h(event));
    },
    subscribe(jobId, handler) {
      const set = subs.get(jobId) ?? new Set();
      set.add(handler);
      subs.set(jobId, set);
      return () => set.delete(handler);
    },
  });
}

export function getProgressHistory(jobId) {
  return history.get(jobId) ?? [];
}

export function resetMemoryProgress() {
  history.clear();
  subs.clear();
}
