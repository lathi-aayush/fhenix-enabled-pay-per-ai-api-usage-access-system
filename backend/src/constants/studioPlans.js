/**
 * Sentinel AI Studio — subscription pricing, credit wallet, and x402 overage tiers.
 * Exchange rates: set ETH_USD_RATE and INR_USD_RATE in env (update weekly).
 */

const ETH_USD = Number(process.env.ETH_USD_RATE) || 3200;
const INR_USD = Number(process.env.INR_USD_RATE) || 84.5;
export const ETH_INR_RATE = ETH_USD * INR_USD;

/** @param {number} wei */
export function weiToEth(wei) {
  return wei / 1e18;
}

/** @param {number} wei */
export function weiToInr(wei) {
  return weiToEth(wei) * ETH_INR_RATE;
}

/** @param {number} wei */
export function weiToUsd(wei) {
  return weiToEth(wei) * ETH_USD;
}

/**
 * Monthly subscription prices in wei (1 ETH = 1e18 wei).
 * @type {Record<string, number>}
 */
export const PLAN_PRICES = {
  free: 0,
  creator: 45_000_000,
  pro: 120_000_000,
  enterprise: 350_000_000,
};

export const PAID_TIERS = ["creator", "pro", "enterprise"];

/** Default monthly Studio Credit pools (overridable via STUDIO_CREDIT_* env). */
export const PLAN_CREDITS = {
  free: Number(process.env.STUDIO_CREDIT_FREE) || 15,
  creator: Number(process.env.STUDIO_CREDIT_CREATOR) || 120,
  pro: Number(process.env.STUDIO_CREDIT_PRO) || 400,
  enterprise: Number(process.env.STUDIO_CREDIT_ENTERPRISE) || 1500,
};

/** Credit cost per run type. */
export const CREDIT_WEIGHTS = {
  prompt_single: 1,
  blog_draft: 2,
  workflow_ai_node: 2,
  workflow_creative: 6,
  agentic_text: 2,
  agentic_images: 8,
  agentic_video: 25,
  agentic_full: 35,
  clipcraft_pack: 5,
};

/** Overage tiers → wei (charged via x402 when credits exhausted). */
export const OVERAGE_PRICES = {
  lite: BigInt(Math.round(Number(process.env.STUDIO_OVERAGE_LITE_ETH || 0.0002) * 1e18)),
  blog: BigInt(Math.round(Number(process.env.STUDIO_OVERAGE_BLOG_ETH || 0.0003) * 1e18)),
  creative: BigInt(Math.round(Number(process.env.STUDIO_OVERAGE_CREATIVE_ETH || 0.001) * 1e18)),
  agentic_med: BigInt(Math.round(Number(process.env.STUDIO_OVERAGE_AGENTIC_MED_ETH || 0.002) * 1e18)),
  agentic_full: BigInt(Math.round(Number(process.env.STUDIO_OVERAGE_AGENTIC_FULL_ETH || 0.005) * 1e18)),
};

/** Run type → overage tier. */
export const RUNTYPE_TO_OVERAGE = {
  prompt_single: "lite",
  blog_draft: "blog",
  workflow_ai_node: "lite",
  workflow_creative: "creative",
  agentic_text: "lite",
  agentic_images: "agentic_med",
  agentic_video: "agentic_full",
  agentic_full: "agentic_full",
  clipcraft_pack: "creative",
};

export const VIDEO_RUN_TYPES = new Set(["agentic_video", "agentic_full"]);
export const TTS_RUN_TYPES = new Set(["agentic_full"]);

/**
 * Feature gates by subscription tier.
 * @type {Record<string, { videoAllowed: boolean, ttsAllowed: boolean, maxBlogs: number, maxProjects: number, publishPlatforms: string[] }>}
 */
export const FEATURE_GATES = {
  free: {
    videoAllowed: false,
    ttsAllowed: false,
    maxBlogs: 3,
    maxProjects: 2,
    publishPlatforms: [],
  },
  creator: {
    videoAllowed: false,
    ttsAllowed: true,
    maxBlogs: 50,
    maxProjects: 10,
    publishPlatforms: ["medium", "linkedin"],
  },
  pro: {
    videoAllowed: true,
    ttsAllowed: true,
    maxBlogs: Infinity,
    maxProjects: Infinity,
    publishPlatforms: ["medium", "linkedin", "wordpress", "devto", "hashnode", "twitter"],
  },
  enterprise: {
    videoAllowed: true,
    ttsAllowed: true,
    maxBlogs: Infinity,
    maxProjects: Infinity,
    publishPlatforms: ["medium", "linkedin", "wordpress", "devto", "hashnode", "twitter", "white-label"],
  },
};

export const RUN_TYPE_LABELS = {
  prompt_single: "Prompt Generator",
  blog_draft: "Blog draft",
  workflow_ai_node: "Workflow AI node",
  workflow_creative: "Creative workflow (prompt + image)",
  agentic_text: "Agentic text run",
  agentic_images: "Agentic images",
  agentic_video: "Agentic video (Veo)",
  agentic_full: "Agentic full run (video + audio)",
  clipcraft_pack: "ClipCraft pack",
};

export function getPlanPriceWei(tier) {
  return PLAN_PRICES[tier] ?? null;
}

/** @deprecated use getPlanPriceWei */
export function getPlanPriceWei(tier) {
  return getPlanPriceWei(tier);
}

export function isPaidTier(tier) {
  return PAID_TIERS.includes(tier);
}

export function getPlanCredits(tier) {
  return PLAN_CREDITS[tier] ?? PLAN_CREDITS.free;
}

export function getFeatureGates(tier) {
  return {
    videoAllowed: true,
    ttsAllowed: true,
    maxBlogs: Infinity,
    maxProjects: Infinity,
    publishPlatforms: ["medium", "linkedin", "wordpress", "devto", "hashnode", "twitter", "white-label"],
  };
}

export function getCreditWeight(runType) {
  return CREDIT_WEIGHTS[runType] ?? CREDIT_WEIGHTS.prompt_single;
}

export function getOverageWei(runType) {
  const tier = RUNTYPE_TO_OVERAGE[runType] ?? "lite";
  return OVERAGE_PRICES[tier] ?? OVERAGE_PRICES.lite;
}
