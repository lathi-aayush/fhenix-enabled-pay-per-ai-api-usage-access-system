import { Worker } from "bullmq";
import mongoose from "mongoose";
import { BlogPost } from "../models/BlogPost.js";
import { getRedisConnection, isRedisAvailable } from "../queues/publishingQueue.js";
import { publishExternalForPlatform } from "../services/blogPublishService.js";
import { processScheduledPostById } from "../services/scheduledPublishScheduler.js";

export function startPublishingWorker() {
  if (process.env.STUDIO_DISABLE_WORKER === "1") {
    console.log("[publishingWorker] disabled via STUDIO_DISABLE_WORKER");
    return null;
  }
  if (!isRedisAvailable()) {
    return null;
  }

  const redis = getRedisConnection();

  const worker = new Worker(
    "publish",
    async (job) => {
      if (job.name === "publish-scheduled") {
        const { blogPostId } = job.data;
        await processScheduledPostById(blogPostId);
        return;
      }

      const { blogPostId, platform, userId } = job.data;
      const post = await BlogPost.findById(blogPostId);
      if (!post) throw new Error("BlogPost not found");

      const result = await publishExternalForPlatform({
        post,
        platform,
        userId: userId || post.userId,
      });

      if (result.ok) {
        post.status = "published";
        post.publishError = undefined;
      } else {
        post.status = "failed";
        post.publishError = result.error;
      }
      await post.save();

      if (!result.ok) throw new Error(result.error);
    },
    { connection: redis, concurrency: 2 }
  );

  let lastWorkerErrorLogged = 0;
  worker.on("error", (err) => {
    const now = Date.now();
    if (now - lastWorkerErrorLogged > 10000) {
      console.error("[Worker] Redis connection error:", err.message);
      lastWorkerErrorLogged = now;
    }
  });

  worker.on("failed", (job, err) => {
    console.error("[publishingWorker] job failed", job?.name, job?.id, err?.message);
  });

  console.log("[publishingWorker] Running (publish + publish-scheduled jobs)");
  return worker;
}
