// @filename: backend/src/studio/clipcraft/mocks/MemoryJobQueue.js

import { asJobQueue } from "../interfaces/IJobQueue.js";

/** @type {import('../interfaces/IJobQueue.js').QueueMessage[]} */
const queue = [];

export function createMemoryJobQueue() {
  return asJobQueue({
    async enqueue(jobId, opts = {}) {
      const msg = {
        messageId: `msg-${jobId}-${Date.now()}`,
        jobId,
        attempt: 1,
        enqueuedAt: new Date().toISOString(),
        delayMs: opts.delayMs ?? 0,
        idempotencyKey: opts.idempotencyKey,
      };
      if (opts.delayMs && opts.delayMs > 0) {
        setTimeout(() => queue.push(msg), opts.delayMs);
      } else {
        queue.push(msg);
      }
      return msg;
    },
    async ack(messageId) {
      const i = queue.findIndex((m) => m.messageId === messageId);
      if (i >= 0) queue.splice(i, 1);
    },
    async nack(messageId, _reason) {
      const m = queue.find((x) => x.messageId === messageId);
      if (m) m.attempt = (m.attempt || 1) + 1;
    },
    async peek() {
      return queue[0] ?? null;
    },
  });
}

export function resetMemoryJobQueue() {
  queue.length = 0;
}

export function getMemoryQueueDepth() {
  return queue.length;
}
