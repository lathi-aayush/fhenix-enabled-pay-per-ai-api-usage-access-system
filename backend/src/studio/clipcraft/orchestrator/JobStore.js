// @filename: backend/src/studio/clipcraft/orchestrator/JobStore.js

import { assertClipJob, createEmptyClipJob } from "../contracts/schemas.js";
import crypto from "crypto";

/** In-memory job persistence — swap for DB adapter in production */
export class JobStore {
  /** @type {Map<string, import('../contracts/schemas.js').ClipJob>} */
  #jobs = new Map();

  create(partial) {
    const id = partial.id ?? `clip-${crypto.randomBytes(6).toString("hex")}`;
    const job = createEmptyClipJob({ ...partial, id });
    assertClipJob(job);
    this.#jobs.set(id, job);
    return job;
  }

  get(id) {
    return this.#jobs.get(id) ?? null;
  }

  save(job) {
    assertClipJob(job);
    job.updatedAt = new Date().toISOString();
    this.#jobs.set(job.id, { ...job, segments: [...(job.segments || [])] });
    return job;
  }

  listByUser(userId) {
    return [...this.#jobs.values()].filter((j) => j.userId === userId);
  }

  clear() {
    this.#jobs.clear();
  }
}

let defaultStore = null;

export function getDefaultJobStore() {
  if (!defaultStore) defaultStore = new JobStore();
  return defaultStore;
}

export function resetDefaultJobStore() {
  defaultStore = null;
}
