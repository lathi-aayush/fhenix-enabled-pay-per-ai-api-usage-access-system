import mongoose from "mongoose";
import { BlogPost } from "../models/BlogPost.js";
import { ConnectedPlatform } from "../models/ConnectedPlatform.js";
import { User } from "../models/User.js";
import { decryptSecret } from "../utils/encrypt.js";
import { getPublishingQueue } from "../queues/publishingQueue.js";
import { publishToPlatform } from "./platformPublishers.js";
import {
  queueScheduledPublish,
  armScheduledPostTimer,
  processScheduledPostById,
} from "./scheduledPublishScheduler.js";
import { parseScheduledFor, isScheduleDue } from "../utils/scheduleDate.js";

export const STUDIO_PLATFORM = "sentinel-studio";

function studioPostUrl(postId) {
  const base = (process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
  return `${base}/studio/blogging-agent?post=${postId}`;
}

export async function publishToStudio(post) {
  const postId = post._id.toString();
  const url = studioPostUrl(postId);
  post.publishedPlatforms = post.publishedPlatforms || [];
  const idx = post.publishedPlatforms.findIndex((p) => p.platform === STUDIO_PLATFORM);
  const entry = { platform: STUDIO_PLATFORM, url, publishedAt: new Date() };
  if (idx >= 0) post.publishedPlatforms[idx] = entry;
  else post.publishedPlatforms.push(entry);
  post.status = "published";
  post.publishError = undefined;
  await post.save();
  return { platform: STUDIO_PLATFORM, url, ok: true };
}

function filterPlatforms(platforms) {
  const valid = ["medium", "linkedin", "devto", "hashnode", "wordpress", STUDIO_PLATFORM];
  return [...new Set(platforms.filter((p) => valid.includes(p)))];
}

async function tryQueueExternal({ post, platform, userId, delay }) {
  if (process.env.STUDIO_PUBLISH_USE_QUEUE !== "1") {
    return { queued: false, reason: "inline_default" };
  }
  const queue = getPublishingQueue();
  if (!queue) return { queued: false, reason: "no_redis" };
  try {
    const opts = { removeOnComplete: true };
    if (delay && delay > 0) opts.delay = delay;
    await queue.add(
      "publish",
      { blogPostId: post._id.toString(), platform, userId: String(userId) },
      opts
    );
    return { queued: true };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

export async function publishExternalForPlatform({ post, platform, userId }) {
  const conn = await ConnectedPlatform.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    platform,
  });
  if (!conn?.accessToken) {
    return { ok: false, error: `Connect ${platform} under Studio → Platforms and paste your API token.` };
  }
  let token;
  try {
    token = decryptSecret(conn.accessToken);
  } catch {
    return { ok: false, error: "Token decrypt failed — reconnect the platform." };
  }
  try {
    const result = await publishToPlatform({
      platform,
      post,
      accessToken: token,
      metadata: conn.metadata || {},
    });
    if (result.ok) {
      post.publishedPlatforms = post.publishedPlatforms || [];
      const existing = post.publishedPlatforms.findIndex((p) => p.platform === platform);
      const entry = {
        platform,
        url: result.url,
        publishedAt: new Date(),
      };
      if (existing >= 0) post.publishedPlatforms[existing] = entry;
      else post.publishedPlatforms.push(entry);
      return { ok: true, url: result.url, platform };
    }
    return { ok: false, error: "Publish rejected" };
  } catch (e) {
    post.publishedPlatforms = (post.publishedPlatforms || []).filter((p) => p.platform !== platform);
    return { ok: false, error: e.message || "Publish failed" };
  }
}

/**
 * Publish a blog post to Studio and/or connected external platforms. Supports scheduling.
 */
export async function publishBlogPost({
  postId,
  userId,
  platforms = [],
  scheduledFor,
  includeStudio = true,
}) {
  const post = await BlogPost.findOne({ _id: postId, userId });
  if (!post) throw new Error("Post not found");

  let targetPlatforms = filterPlatforms([...platforms]);
  if (includeStudio && !targetPlatforms.includes(STUDIO_PLATFORM)) {
    targetPlatforms.unshift(STUDIO_PLATFORM);
  }
  if (targetPlatforms.length === 0) {
    targetPlatforms = includeStudio ? [STUDIO_PLATFORM] : [];
  }
  if (targetPlatforms.length === 0) {
    throw new Error("Select at least one platform (Dev.to, Medium, LinkedIn, …) or enable Studio publish.");
  }

  const externalOnly = targetPlatforms.filter((p) => p !== STUDIO_PLATFORM);

  if (scheduledFor) {
    const runAt = parseScheduledFor(scheduledFor);
    if (runAt.getTime() < Date.now() + 30_000) {
      throw new Error("Schedule time must be at least 30 seconds in the future.");
    }
    if (externalOnly.length === 0 && !includeStudio) {
      throw new Error("Select at least one platform (LinkedIn, Dev.to, etc.) to schedule.");
    }

    post.scheduledFor = runAt;
    post.scheduledPlatforms = externalOnly.length ? externalOnly : targetPlatforms;
    post.status = "scheduled";
    post.publishError = undefined;
    await post.save();

    if (isScheduleDue(runAt, 2000)) {
      const immediate = await processScheduledPostById(post._id);
      if (!immediate?.skipped) {
        const refreshed = await BlogPost.findById(post._id);
        return {
          post: refreshed || post,
          published: immediate?.result?.published || [],
          queued: immediate?.result?.queued || [],
          errors: immediate?.result?.errors || [],
          scheduled: false,
          scheduledFor: runAt,
          scheduledPlatforms: post.scheduledPlatforms,
          message: "Published now (scheduled time was due).",
          studioUrl: studioPostUrl(post._id.toString()),
        };
      }
    }

    armScheduledPostTimer(post._id, runAt);
    const delayJobQueued = await queueScheduledPublish({
      postId: post._id,
      userId,
      platforms: post.scheduledPlatforms,
      runAt,
    });

    return {
      post,
      published: [],
      queued: [],
      errors: [],
      scheduled: true,
      scheduledFor: runAt,
      scheduledPlatforms: post.scheduledPlatforms,
      delayJobQueued,
      message: `Scheduled for ${runAt.toLocaleString()} → ${post.scheduledPlatforms.join(", ")}`,
      studioUrl: studioPostUrl(post._id.toString()),
    };
  }

  const published = [];
  const queued = [];
  const errors = [];

  for (const platform of targetPlatforms) {
    if (platform === STUDIO_PLATFORM) {
      published.push(await publishToStudio(post));
      continue;
    }

    const q = await tryQueueExternal({ post, platform, userId });
    if (q.queued) {
      queued.push(platform);
      post.status = "publishing";
    } else {
      const inline = await publishExternalForPlatform({ post, platform, userId });
      if (inline.ok) published.push(inline);
      else errors.push({ platform, message: inline.error });
    }
  }

  if (published.length > 0 && post.status !== "publishing") {
    post.status = "published";
  } else if (queued.length && !published.length) {
    post.status = "publishing";
  }

  if (errors.length && !published.length && !queued.length) {
    post.publishError = errors.map((e) => `${e.platform}: ${e.message}`).join(" ");
    post.status = "failed";
  } else if (errors.length) {
    post.publishError = errors.map((e) => `${e.platform}: ${e.message}`).join(" ");
  } else {
    post.publishError = undefined;
  }

  await post.save();

  return {
    post,
    published,
    queued,
    errors,
    studioUrl: studioPostUrl(post._id.toString()),
  };
}
