import { BlogPost } from "../models/BlogPost.js";
import { STUDIO_PLATFORM } from "./blogPublishService.js";
import { getPublishingQueue } from "../queues/publishingQueue.js";
import { isScheduleDue } from "../utils/scheduleDate.js";

let intervalId = null;
const pendingTimeouts = new Map();

function platformsForPost(row) {
  return row.scheduledPlatforms?.length > 0 ? [...row.scheduledPlatforms] : [STUDIO_PLATFORM];
}

/**
 * Claim and publish one scheduled post (idempotent — skips if not scheduled).
 */
export async function processScheduledPostById(postId) {
  const claimed = await BlogPost.findOneAndUpdate(
    { _id: postId, status: "scheduled" },
    { $set: { status: "publishing" } },
    { new: true }
  );
  if (!claimed) return { skipped: true };

  const platforms = platformsForPost(claimed);
  const includeStudio = platforms.includes(STUDIO_PLATFORM);

  try {
    const { publishBlogPost } = await import("./blogPublishService.js");
    const result = await publishBlogPost({
      postId: claimed._id,
      userId: claimed.userId,
      platforms,
      includeStudio,
      scheduledFor: null,
    });
    console.log(`[scheduler] Published scheduled post ${postId}`);
    return { skipped: false, result };
  } catch (e) {
    console.error(`[scheduler] Failed post ${postId}:`, e.message);
    await BlogPost.findByIdAndUpdate(postId, {
      status: "failed",
      publishError: e.message,
    });
    throw e;
  }
}

export async function processDueScheduledPosts() {
  const due = await BlogPost.find({
    status: "scheduled",
    scheduledFor: { $lte: new Date() },
  })
    .limit(15)
    .lean();

  for (const row of due) {
    try {
      await processScheduledPostById(row._id);
    } catch {
      /* logged in processScheduledPostById */
    }
  }
}

/** One-shot timer so posts fire at the right time without waiting for the poll interval. */
export function armScheduledPostTimer(postId, runAt) {
  const key = String(postId);
  if (pendingTimeouts.has(key)) {
    clearTimeout(pendingTimeouts.get(key));
    pendingTimeouts.delete(key);
  }
  const delayMs = runAt.getTime() - Date.now();
  if (delayMs <= 0) {
    processScheduledPostById(postId).catch((e) =>
      console.warn("[scheduler] immediate:", e.message)
    );
    return;
  }
  if (delayMs > 7 * 24 * 60 * 60 * 1000) return;

  const t = setTimeout(() => {
    pendingTimeouts.delete(key);
    processScheduledPostById(postId).catch((e) =>
      console.warn("[scheduler] timer:", e.message)
    );
  }, delayMs);
  pendingTimeouts.set(key, t);
}

export function startScheduledPublishScheduler() {
  if (process.env.STUDIO_DISABLE_SCHEDULER === "1") return;
  if (intervalId) return;

  processDueScheduledPosts().catch((e) => console.warn("[scheduler] initial run:", e.message));

  const pollMs = Number(process.env.STUDIO_SCHEDULER_POLL_MS) || 15_000;
  intervalId = setInterval(() => {
    processDueScheduledPosts().catch((e) => console.warn("[scheduler]", e.message));
  }, pollMs);

  console.log(`[scheduler] Scheduled publish checker running (every ${pollMs / 1000}s)`);
}

/** Optional Redis delayed job (backup if in-process timer is missed). */
export async function queueScheduledPublish({ postId, userId, platforms, runAt }) {
  if (process.env.STUDIO_PUBLISH_USE_QUEUE !== "1") return false;
  const queue = getPublishingQueue();
  if (!queue) return false;
  const delay = Math.max(1000, new Date(runAt).getTime() - Date.now());
  try {
    await queue.add(
      "publish-scheduled",
      { blogPostId: String(postId), userId: String(userId), platforms },
      { delay, removeOnComplete: true, jobId: `sched_${postId}_${runAt.getTime()}` }
    );
    return true;
  } catch {
    return false;
  }
}

export { isScheduleDue };
