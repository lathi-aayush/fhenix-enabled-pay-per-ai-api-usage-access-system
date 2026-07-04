import {
  CREDIT_WEIGHTS,
  getFeatureGates,
  getPlanCredits,
  VIDEO_RUN_TYPES,
  TTS_RUN_TYPES,
} from "../constants/studioPlans.js";
import { User } from "../models/User.js";

/**
 * Infer workflow run type from node types for credit / overage billing.
 * @param {Array<{ type?: string }>} nodes
 */
export function inferWorkflowRunType(nodes = []) {
  const types = new Set(nodes.map((n) => n.type));
  const hasVideo = types.has("agenticVideo") || types.has("videoGen");
  const hasAudio = types.has("agenticAudio") || types.has("tts");
  const hasImage = types.has("agenticImage") || types.has("imageGen");
  const hasPromptImage = types.has("promptGen") && hasImage;
  const hasAgenticText = types.has("agenticText");
  const hasBlog = types.has("blog");

  if (hasVideo && hasAudio) return "agentic_full";
  if (hasVideo) return "agentic_video";
  if (hasAgenticText && hasImage) return "agentic_images";
  if (hasPromptImage || (types.has("promptGen") && hasImage)) return "workflow_creative";
  if (hasImage) return "workflow_creative";
  if (hasBlog) return "blog_draft";
  if (hasAgenticText || types.has("ai") || types.has("agenticCode")) return "workflow_ai_node";
  return "workflow_ai_node";
}

/**
 * @param {string} tier
 * @param {string} runType
 */
export function assertFeatureGate(tier, runType) {
  const gates = getFeatureGates(tier);
  if (VIDEO_RUN_TYPES.has(runType) && !gates.videoAllowed) {
    const err = new Error(
      "Video generation (Veo) requires a Pro or Enterprise plan. Upgrade to unlock video runs."
    );
    err.status = 403;
    err.code = "VIDEO_GATED";
    err.requiredPlan = "pro";
    throw err;
  }
  if (TTS_RUN_TYPES.has(runType) && !gates.ttsAllowed) {
    const err = new Error(
      "Text-to-speech and full agentic runs with audio require Creator plan or above."
    );
    err.status = 403;
    err.code = "TTS_GATED";
    err.requiredPlan = "creator";
    throw err;
  }
}

/**
 * Reset studio credits to tier pool.
 * @param {import("../models/User.js").User} user
 */
export function resetMonthlyCredits(user) {
  const tier = user.subscriptionTier || "free";
  user.studioCredits = getPlanCredits(tier);
  return user.studioCredits;
}

/**
 * @param {string} userId
 * @param {string} runType
 */
export async function deductStudioCredits(userId, runType) {
  const cost = CREDIT_WEIGHTS[runType] ?? 1;
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  const tier = user.subscriptionTier || "free";
  assertFeatureGate(tier, runType);

  if ((user.studioCredits ?? 0) < cost) {
    return { sufficient: false, user, cost };
  }

  user.studioCredits = Math.max(0, (user.studioCredits ?? 0) - cost);
  await user.save();
  return { sufficient: true, user, cost, deducted: cost };
}

/**
 * @param {string} userId
 * @param {string} txId
 */
export async function isOverageTxReplay(userId, txId) {
  const user = await User.findById(userId).select("studioOverageLog");
  if (!user) return false;
  return (user.studioOverageLog || []).some((e) => e.txId === txId);
}

/**
 * @param {string} userId
 * @param {{ runType: string, ethAmount: number, txId: string }} entry
 */
export async function logStudioOverage(userId, entry) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  if ((user.studioOverageLog || []).some((e) => e.txId === entry.txId)) {
    const err = new Error("Replay attack detected: transaction already used for Studio overage");
    err.status = 409;
    throw err;
  }
  user.studioOverageLog = user.studioOverageLog || [];
  user.studioOverageLog.push({
    runType: entry.runType,
    ethAmount: entry.ethAmount,
    txId: entry.txId,
    timestamp: new Date(),
    settled: true,
  });
  await user.save();
  return user;
}
