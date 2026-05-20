import { Worker } from "bullmq";
import mongoose from "mongoose";
import { BlogPost } from "../models/BlogPost.js";
import { ConnectedPlatform } from "../models/ConnectedPlatform.js";
import { decryptSecret } from "../utils/encrypt.js";
import { getRedisConnection } from "../queues/publishingQueue.js";

/**
 * Platform publishing: queue-only. Replace publishToPlatform with real API calls.
 */
async function publishToPlatform({ platform, title, contentHtml, accessToken }) {
  void contentHtml;
  void accessToken;
  return {
    ok: true,
    url: `https://${platform}.example/published/${Date.now()}`,
  };
}

function markdownToHtml(md) {
  return String(md)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>(\s)/g, "&gt;$1")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/m, "<p>$1</p>");
}

export function startPublishingWorker() {
  if (process.env.STUDIO_DISABLE_WORKER === "1") {
    console.log("[publishingWorker] disabled via STUDIO_DISABLE_WORKER");
    return null;
  }

  let redis;
  try {
    redis = getRedisConnection();
  } catch (e) {
    console.warn("[publishingWorker] Redis unavailable, worker skipped:", e.message);
    return null;
  }

  const worker = new Worker(
    "publishing",
    async (job) => {
      const { blogPostId, platform, userId } = job.data;
      const post = await BlogPost.findById(blogPostId);
      if (!post) {
        throw new Error("BlogPost not found");
      }

      const conn = await ConnectedPlatform.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        platform,
      });

      if (!conn?.accessToken) {
        post.status = "failed";
        post.publishError = `No connected account for ${platform}`;
        await post.save();
        return;
      }

      let token;
      try {
        token = decryptSecret(conn.accessToken);
      } catch {
        post.status = "failed";
        post.publishError = "Token decrypt failed";
        await post.save();
        return;
      }

      try {
        const result = await publishToPlatform({
          platform,
          title: post.title,
          contentHtml: markdownToHtml(post.content),
          accessToken: token,
        });

        if (result.ok) {
          post.publishedPlatforms = post.publishedPlatforms || [];
          post.publishedPlatforms.push({
            platform,
            url: result.url,
            publishedAt: new Date(),
          });
          post.status = "published";
          post.publishError = undefined;
        } else {
          post.status = "failed";
          post.publishError = "Publish rejected";
        }
        await post.save();
      } catch (e) {
        post.status = "failed";
        post.publishError = e.message || "Publish error";
        await post.save();
        throw e;
      }
    },
    { connection: redis, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    console.error("[publishingWorker] job failed", job?.id, err);
  });

  return worker;
}
