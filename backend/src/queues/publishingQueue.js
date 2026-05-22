import { Queue } from "bullmq";

const redisConnection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

export const publishQueue = new Queue('publish', {
  connection: redisConnection
});

publishQueue.on('error', (err) => {
  console.error('[Queue] Redis connection error:', err.message);
});

// Helper functions for backward compatibility
export function getPublishingQueue() {
  return publishQueue;
}

export function getRedisConnection() {
  return redisConnection;
}
