import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { BlogPost } from "../models/BlogPost.js";
import { ConnectedPlatform } from "../models/ConnectedPlatform.js";
import { User } from "../models/User.js";
import { encryptSecret } from "../utils/encrypt.js";
import {
  streamBlogToResponse,
  generateHashtags,
  generateMetadata,
  generateTitleSuggestions,
  generateSocialSnippets,
  assertProjectSlot,
  incrementBlogUsage,
  ensureUsageMonth,
} from "../services/blog.service.js";
import { publishBlogPost, STUDIO_PLATFORM } from "../services/blogPublishService.js";
import { PLATFORM_SETUP, verifyPlatformCredentials } from "../services/platformPublishers.js";
import { parseScheduledFor } from "../utils/scheduleDate.js";

// --- Blog ---

export async function postGenerateStream(req, res) {
  const {
    projectId,
    topic,
    keywords = [],
    tone = "professional",
    targetAudience = "",
    wordCount = 800,
    brandVoice = "",
  } = req.body;

  if (!projectId || !topic) {
    return res.status(400).json({ error: "projectId and topic are required" });
  }
  if (!mongoose.isValidObjectId(projectId)) {
    return res.status(400).json({ error: "Invalid projectId" });
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user.userId });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let fullContent = "";
  try {
    fullContent = await streamBlogToResponse(res, {
      topic,
      keywords,
      tone,
      targetAudience,
      wordCount: Number(wordCount) || 800,
      brandVoice: brandVoice || project.brandVoice || "",
    });

    const post = await BlogPost.create({
      projectId,
      userId: req.user.userId,
      title: topic.slice(0, 200),
      content: fullContent,
      keywords: Array.isArray(keywords) ? keywords : [],
      tone,
      targetAudience,
      status: "draft",
    });
    await incrementBlogUsage(req.user.userId);
    res.write(`data: ${JSON.stringify({ postId: post._id.toString() })}\n\n`);
  } catch (e) {
    console.error("[studio generate]", e);
    res.write(`data: ${JSON.stringify({ error: e.message || "Generation failed" })}\n\n`);
  }
  res.end();
}

export async function postBlogSave(req, res) {
  const {
    id,
    projectId,
    title,
    content,
    keywords,
    tone,
    targetAudience,
    metaDescription,
    hashtags,
    titleSuggestions,
    socialSnippets,
    status,
    scheduledFor,
  } = req.body;

  if (id && mongoose.isValidObjectId(id)) {
    const post = await BlogPost.findOne({ _id: id, userId: req.user.userId });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (title != null) post.title = title;
    if (content != null) post.content = content;
    if (keywords) post.keywords = keywords;
    if (tone) post.tone = tone;
    if (targetAudience != null) post.targetAudience = targetAudience;
    if (metaDescription != null) post.metaDescription = metaDescription;
    if (hashtags) post.hashtags = hashtags;
    if (titleSuggestions) post.titleSuggestions = titleSuggestions;
    if (socialSnippets) post.socialSnippets = { ...post.socialSnippets, ...socialSnippets };
    if (status) post.status = status;
    if (scheduledFor !== undefined) {
      post.scheduledFor = scheduledFor ? parseScheduledFor(scheduledFor) : null;
    }
    post.wordCount = String(post.content).trim().split(/\s+/).filter(Boolean).length;
    post.readingTime = Math.max(1, Math.ceil(post.wordCount / 200));
    await post.save();
    return res.json({ post });
  }

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    return res.status(400).json({ error: "projectId required for new draft" });
  }
  const project = await Project.findOne({ _id: projectId, userId: req.user.userId });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const post = await BlogPost.create({
    projectId,
    userId: req.user.userId,
    title: title || "Untitled",
    content: content || "",
    keywords: keywords || [],
    tone: tone || "professional",
    targetAudience: targetAudience || "",
    metaDescription: metaDescription || "",
    hashtags: hashtags || [],
    titleSuggestions: titleSuggestions || [],
    socialSnippets: socialSnippets || { linkedin: "", twitter: "" },
    status: status || "draft",
    scheduledFor: scheduledFor ? parseScheduledFor(scheduledFor) : undefined,
  });
  post.wordCount = String(post.content).trim().split(/\s+/).filter(Boolean).length;
  post.readingTime = Math.max(1, Math.ceil(post.wordCount / 200));
  await post.save();
  res.status(201).json({ post });
}

export async function postBlogMetadata(req, res) {
  const { postId, title, content } = req.body;
  let post;
  if (postId && mongoose.isValidObjectId(postId)) {
    post = await BlogPost.findOne({ _id: postId, userId: req.user.userId });
  }
  const effectiveTitle = title || post?.title || "";
  const effectiveContent = content || post?.content || "";
  if (!effectiveContent) {
    return res.status(400).json({ error: "content required" });
  }

  const [meta, titles, hashtags, social] = await Promise.all([
    generateMetadata({ title: effectiveTitle, content: effectiveContent }),
    generateTitleSuggestions({ topic: effectiveTitle || "Blog post", tone: post?.tone || "professional" }),
    generateHashtags({
      topic: effectiveTitle,
      keywords: post?.keywords || [],
      platform: "general",
    }),
    generateSocialSnippets({ content: effectiveContent }),
  ]);

  if (post) {
    post.metaDescription = meta.metaDescription;
    post.seoScore = meta.seoScore;
    post.titleSuggestions = titles;
    post.hashtags = hashtags;
    post.socialSnippets = social;
    await post.save();
  }

  res.json({
    metaDescription: meta.metaDescription,
    seoScore: meta.seoScore,
    titleSuggestions: titles,
    hashtags,
    socialSnippets: social,
    post: post || null,
  });
}

export async function getPlatformSetup(req, res) {
  res.json({ platforms: PLATFORM_SETUP });
}

export async function postBlogSchedule(req, res) {
  const { postId, platforms = [], scheduledFor, publishToStudio = true } = req.body;
  if (!postId || !mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ error: "postId required" });
  }

  const includeStudio = publishToStudio !== false;
  let targetPlatforms = Array.isArray(platforms) ? [...platforms] : [];
  if (includeStudio && !targetPlatforms.includes(STUDIO_PLATFORM)) {
    targetPlatforms.unshift(STUDIO_PLATFORM);
  }
  if (targetPlatforms.length === 0) {
    return res.status(400).json({
      error: includeStudio
        ? "Select at least one platform"
        : "Select Dev.to, Medium, LinkedIn, etc. and connect them under Studio → Platforms",
    });
  }

  try {
    const result = await publishBlogPost({
      postId,
      userId: req.user.userId,
      platforms: targetPlatforms,
      scheduledFor: scheduledFor && String(scheduledFor).trim() ? scheduledFor : null,
      includeStudio,
    });
    res.status(202).json({
      ok: true,
      post: result.post,
      published: result.published,
      queued: result.queued,
      errors: result.errors,
      studioUrl: result.studioUrl,
      scheduled: result.scheduled || false,
      message: result.message,
      scheduledFor: result.scheduledFor,
      scheduledPlatforms: result.scheduledPlatforms,
    });
  } catch (e) {
    console.error("[studio publish]", e);
    res.status(400).json({ error: e.message || "Publish failed" });
  }
}

export async function getBlog(req, res) {
  const post = await BlogPost.findOne({
    _id: req.params.id,
    userId: req.user.userId,
  }).populate("projectId", "title color");
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json({ post });
}

export async function patchBlog(req, res) {
  const post = await BlogPost.findOne({
    _id: req.params.id,
    userId: req.user.userId,
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  Object.assign(post, req.body);
  if (req.body.content != null) {
    post.wordCount = String(post.content).trim().split(/\s+/).filter(Boolean).length;
    post.readingTime = Math.max(1, Math.ceil(post.wordCount / 200));
  }
  await post.save();
  res.json({ post });
}

export async function deleteBlog(req, res) {
  const r = await BlogPost.deleteOne({ _id: req.params.id, userId: req.user.userId });
  if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}

// --- Projects ---

export async function listProjects(req, res) {
  const items = await Project.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
  res.json({ projects: items });
}

export async function createProject(req, res) {
  await assertProjectSlot(req.user.userId);
  const { title, description, brandVoice, connectedPlatforms, color } = req.body;
  const project = await Project.create({
    userId: req.user.userId,
    title: title || "Untitled project",
    description: description || "",
    brandVoice: brandVoice || "",
    connectedPlatforms: connectedPlatforms || [],
    color: color || "#031634",
  });
  res.status(201).json({ project });
}

export async function getProject(req, res) {
  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user.userId,
  });
  if (!project) return res.status(404).json({ error: "Not found" });
  const posts = await BlogPost.find({ projectId: project._id }).sort({ updatedAt: -1 }).limit(100);
  res.json({ project, posts });
}

export async function patchProject(req, res) {
  const project = await Project.findOne({
    _id: req.params.id,
    userId: req.user.userId,
  });
  if (!project) return res.status(404).json({ error: "Not found" });
  Object.assign(project, req.body);
  await project.save();
  res.json({ project });
}

export async function deleteProject(req, res) {
  const r = await Project.deleteOne({ _id: req.params.id, userId: req.user.userId });
  if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  await BlogPost.deleteMany({ projectId: req.params.id });
  res.json({ ok: true });
}

// --- Platforms ---

export async function listPlatforms(req, res) {
  const items = await ConnectedPlatform.find({ userId: req.user.userId });
  const safe = items.map((p) => ({
    id: p._id,
    platform: p.platform,
    metadata: p.metadata,
    connectedAt: p.connectedAt,
    tokenExpiresAt: p.tokenExpiresAt,
  }));
  res.json({ platforms: safe });
}

export async function connectPlatform(req, res) {
  const { platform, accessToken, refreshToken, tokenExpiresAt, metadata } = req.body;
  if (!platform || !accessToken) {
    return res.status(400).json({ error: "platform and accessToken required" });
  }
  let normalizedToken;
  try {
    normalizedToken = await verifyPlatformCredentials(platform, accessToken);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Invalid credentials" });
  }
  const encAccess = encryptSecret(normalizedToken);
  const encRefresh = refreshToken ? encryptSecret(refreshToken) : undefined;

  await ConnectedPlatform.findOneAndUpdate(
    { userId: req.user.userId, platform },
    {
      accessToken: encAccess,
      refreshToken: encRefresh,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      metadata: metadata || {},
      connectedAt: new Date(),
    },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
}

export async function disconnectPlatform(req, res) {
  const r = await ConnectedPlatform.deleteOne({
    _id: req.params.id,
    userId: req.user.userId,
  });
  if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}

// --- Analytics & calendar ---

export async function getStudioAnalytics(req, res) {
  const userId = req.user.userId;
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const posts = await BlogPost.find({
    userId,
    createdAt: { $gte: eightWeeksAgo },
  });

  const byWeek = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i * 7);
    const label = `W${8 - i}`;
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = posts.filter((p) => p.createdAt >= start && p.createdAt < end).length;
    byWeek.push({ label, count });
  }

  const byStatus = await BlogPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);

  const byPlatform = await BlogPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $unwind: { path: "$publishedPlatforms", preserveNullAndEmptyArrays: false } },
    { $group: { _id: "$publishedPlatforms.platform", n: { $sum: 1 } } },
  ]);

  const topProjects = await BlogPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$projectId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  const projTitles = await Project.find({
    _id: { $in: topProjects.map((t) => t._id) },
  });
  const titleMap = Object.fromEntries(projTitles.map((p) => [p._id.toString(), p.title]));

  const wordCountByWeek = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i * 7);
    const label = `W${8 - i}`;
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const weekPosts = posts.filter((p) => p.createdAt >= start && p.createdAt < end);
    const avg =
      weekPosts.length === 0
        ? 0
        : Math.round(
            weekPosts.reduce((s, p) => s + (p.wordCount || 0), 0) / weekPosts.length
          );
    wordCountByWeek.push({ label, avg });
  }

  res.json({
    blogsPerWeek: byWeek,
    statusBreakdown: byStatus.map((s) => ({ status: s._id, count: s.n })),
    platformBreakdown: byPlatform.map((s) => ({ platform: s._id, count: s.n })),
    topProjects: topProjects.map((t) => ({
      projectId: t._id,
      title: titleMap[t._id.toString()] || "Project",
      count: t.count,
    })),
    wordCountByWeek,
  });
}

export async function getCalendar(req, res) {
  const { start, end } = req.query;
  const q = { userId: req.user.userId };
  const range = {};
  if (start) range.$gte = new Date(start);
  if (end) range.$lte = new Date(end);
  q.scheduledFor =
    start || end ? { ...range, $exists: true, $ne: null } : { $ne: null };
  const items = await BlogPost.find({
    ...q,
    status: { $in: ["scheduled", "publishing"] },
  })
    .sort({ scheduledFor: 1 })
    .limit(200);
  res.json({ posts: items });
}

export async function listDrafts(req, res) {
  const posts = await BlogPost.find({ userId: req.user.userId, status: "draft" })
    .sort({ updatedAt: -1 })
    .limit(30)
    .populate("projectId", "title color");
  res.json({ posts });
}

export async function listPublished(req, res) {
  const posts = await BlogPost.find({
    userId: req.user.userId,
    $or: [
      { status: "published" },
      { status: "publishing" },
      { "publishedPlatforms.0": { $exists: true } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate("projectId", "title color");
  res.json({ posts });
}

export async function getUsage(req, res) {
  const user = await ensureUsageMonth(req.user.userId);
  const tier = user.subscriptionTier || "free";
  const limits = { free: 3, creator: 50, pro: null, enterprise: null };
  res.json({
    tier,
    monthlyBlogsUsed: user.monthlyBlogsUsed || 0,
    monthlyBlogLimit: limits[tier],
    usageResetAt: user.usageResetAt,
  });
}
