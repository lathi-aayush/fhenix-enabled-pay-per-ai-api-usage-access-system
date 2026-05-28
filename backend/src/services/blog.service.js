import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { BlogPost } from "../models/BlogPost.js";
import {
  generateBlogStream,
  generateHashtags,
  generateMetadata,
  generateTitleSuggestions,
  generateSocialSnippets,
} from "../providers/groqProvider.js";
import { STUDIO_TIER_LIMITS } from "../constants/studioLimits.js";

const TIER_LIMITS = STUDIO_TIER_LIMITS;

export async function ensureUsageMonth(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!user.usageResetAt || user.usageResetAt < startOfMonth) {
    user.monthlyBlogsUsed = 0;
    user.monthlyPromptsUsed = 0;
    user.usageResetAt = startOfMonth;
    await user.save();
  }
  return user;
}

/** Returns whether the user may create another project given their current count. */
export function canCreateProject(user, currentCount) {
  const tier = user.subscriptionTier || "free";
  const max = TIER_LIMITS[tier]?.maxProjects ?? 2;
  if (max === Infinity) return true;
  return currentCount < max;
}

export async function countUserProjects(userId) {
  return Project.countDocuments({ userId });
}

export async function assertProjectSlot(userId) {
  const user = await ensureUsageMonth(userId);
  if (!user) return;
  const tier = user.subscriptionTier || "free";
  const max = TIER_LIMITS[tier]?.maxProjects ?? 2;
  if (max === Infinity) return;
  const n = await countUserProjects(userId);
  if (!canCreateProject(user, n)) {
    const err = new Error(`Project limit reached for ${tier} tier (${max})`);
    err.status = 403;
    throw err;
  }
}

export async function assertBlogQuota(userId) {
  const user = await ensureUsageMonth(userId);
  const tier = user.subscriptionTier || "free";
  const limit = TIER_LIMITS[tier]?.blogsPerMonth ?? 3;
  if (limit === Infinity) return user;
  if ((user.monthlyBlogsUsed || 0) >= limit) {
    const err = new Error("Monthly blog generation quota exceeded");
    err.status = 403;
    throw err;
  }
  return user;
}

export async function incrementBlogUsage(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { monthlyBlogsUsed: 1 } });
}

export async function assertPromptQuota(userId) {
  const user = await ensureUsageMonth(userId);
  const tier = user.subscriptionTier || "free";
  const limit = TIER_LIMITS[tier]?.promptsPerMonth ?? 10;
  if (limit === Infinity) return user;
  if ((user.monthlyPromptsUsed || 0) >= limit) {
    const err = new Error("Monthly prompt generator quota exceeded. Upgrade your Studio plan.");
    err.status = 403;
    throw err;
  }
  return user;
}

export async function incrementPromptUsage(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { monthlyPromptsUsed: 1 } });
}

function readingTimeMinutes(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export async function streamBlogToResponse(res, params) {
  const stream = await generateBlogStream(params);
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
    }
  }
  res.write("data: [DONE]\n\n");
  return full;
}

export async function enrichPostMetadata(post) {
  const title = post.title || "Untitled";
  const meta = await generateMetadata({ title, content: post.content });
  const titles = await generateTitleSuggestions({ topic: title, tone: post.tone });
  const hashtags = await generateHashtags({
    topic: title,
    keywords: post.keywords,
    platform: "general",
  });
  const social = await generateSocialSnippets({ content: post.content });

  post.metaDescription = meta.metaDescription;
  post.seoScore = meta.seoScore;
  post.titleSuggestions = titles;
  post.hashtags = hashtags;
  post.socialSnippets = social;
  post.wordCount = String(post.content).trim().split(/\s+/).filter(Boolean).length;
  post.readingTime = readingTimeMinutes(post.content);
  await post.save();
  return post;
}

export {
  generateHashtags,
  generateMetadata,
  generateTitleSuggestions,
  generateSocialSnippets,
  readingTimeMinutes,
};
