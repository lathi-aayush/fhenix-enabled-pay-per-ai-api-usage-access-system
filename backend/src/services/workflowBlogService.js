import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { BlogPost } from "../models/BlogPost.js";
import {
  assertBlogQuota,
  incrementBlogUsage,
  enrichPostMetadata,
  readingTimeMinutes,
} from "./blog.service.js";
import { generateBlogFromSource } from "../providers/groqProvider.js";
import { tryParseJson } from "./structuredOutput.js";
import { publishBlogPost, STUDIO_PLATFORM } from "./blogPublishService.js";

function extractTitleFromMaterial(text) {
  const s = String(text || "");
  const yt = s.match(/Title:\s*(.+)/i);
  if (yt?.[1]) return yt[1].trim().slice(0, 200);
  const parsed = tryParseJson(s);
  if (parsed?.title) return String(parsed.title).slice(0, 200);
  if (parsed?.summary) return String(parsed.summary).split(/[.!?]/)[0].slice(0, 120);
  const h1 = s.match(/^#\s+(.+)/m);
  if (h1?.[1]) return h1[1].trim().slice(0, 200);
  const first = s.split("\n").find((l) => l.trim().length > 10);
  return (first || "Workflow Article").trim().slice(0, 200);
}

/**
 * Create a Blogging Agent post from upstream workflow content and optionally queue publish.
 */
export async function publishWorkflowToBlog({
  userId,
  projectId,
  upstreamContent,
  topic: topicOverride,
  tone = "professional",
  targetAudience = "",
  wordCount = 1000,
  keywords = [],
  brandVoice = "",
  publishMode = "draft",
  platforms = [],
  scheduledFor = null,
}) {
  if (!userId) throw new Error("userId required");
  await assertBlogQuota(userId);

  let project;
  if (projectId && mongoose.isValidObjectId(projectId)) {
    project = await Project.findOne({ _id: projectId, userId });
  }
  if (!project) {
    project = await Project.findOne({ userId }).sort({ updatedAt: -1 });
  }
  if (!project) {
    throw new Error("No studio project found. Create a project under Studio → Projects first.");
  }

  const sourceMaterial = String(upstreamContent || "").trim();
  if (!sourceMaterial) {
    throw new Error("No content from upstream nodes to turn into a blog post.");
  }

  const topic = topicOverride?.trim() || extractTitleFromMaterial(sourceMaterial);
  const content = await generateBlogFromSource({
    topic,
    sourceMaterial,
    keywords,
    tone,
    targetAudience,
    wordCount: Number(wordCount) || 1000,
    brandVoice: brandVoice || project.brandVoice || "",
  });

  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() || topic;

  const post = await BlogPost.create({
    projectId: project._id,
    userId,
    title,
    content,
    keywords: Array.isArray(keywords) ? keywords : [],
    tone,
    targetAudience,
    status: "draft",
    wordCount: String(content).trim().split(/\s+/).filter(Boolean).length,
    readingTime: readingTimeMinutes(content),
  });

  await incrementBlogUsage(userId);
  await enrichPostMetadata(post);

  const shouldPublish = publishMode === "studio" || publishMode === "publish";
  let publishResult = null;
  const queued = [];

  if (shouldPublish) {
    const external = (platforms || []).filter((p) => p !== STUDIO_PLATFORM);
    if (publishMode === "publish" && external.length === 0) {
      throw new Error(
        "Blog Agent node: select at least one external platform (Dev.to, Medium, LinkedIn) on the node."
      );
    }
    const targetPlatforms =
      publishMode === "publish" ? external : [STUDIO_PLATFORM];
    const scheduleAt =
      scheduledFor && String(scheduledFor).trim() ? String(scheduledFor).trim() : null;
    publishResult = await publishBlogPost({
      postId: post._id,
      userId,
      platforms: targetPlatforms,
      includeStudio: publishMode === "studio",
      scheduledFor: scheduleAt,
    });
    const fresh = await BlogPost.findById(post._id);
    if (fresh) {
      post.status = fresh.status;
      post.publishError = fresh.publishError;
      post.publishedPlatforms = fresh.publishedPlatforms;
      post.scheduledFor = fresh.scheduledFor;
      post.scheduledPlatforms = fresh.scheduledPlatforms;
    }
    for (const p of publishResult.published || []) queued.push(p.platform);
    for (const p of publishResult.queued || []) queued.push(p);
  }

  return {
    blogPostId: post._id.toString(),
    projectId: project._id.toString(),
    title: post.title,
    status: post.status,
    wordCount: post.wordCount,
    readingTime: post.readingTime,
    metaDescription: post.metaDescription,
    seoScore: post.seoScore,
    queuedPlatforms: [...new Set(queued)],
    publishedPlatforms: post.publishedPlatforms || [],
    publishError: post.publishError || null,
    studioUrl: publishResult?.studioUrl || null,
    editPath: "/studio/blogging-agent",
    publishedPath: "/studio/published",
    publishMode: shouldPublish ? publishMode : "draft",
    scheduled: publishResult?.scheduled || false,
    scheduledFor: post.scheduledFor || publishResult?.scheduledFor || null,
    scheduledPlatforms: post.scheduledPlatforms || publishResult?.scheduledPlatforms || [],
    scheduleMessage: publishResult?.message || null,
  };
}
