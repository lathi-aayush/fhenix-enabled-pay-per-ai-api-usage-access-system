/** Studio plan prices — keep in sync with backend/src/constants/studioPlans.js */

const ETH_USD = Number(import.meta.env.VITE_ETH_USD_RATE) || 3200;
const INR_USD = Number(import.meta.env.VITE_INR_USD_RATE) || 84.5;
export const ETH_INR_RATE = ETH_USD * INR_USD;

export const RATE_NOTE =
  "INR/USD equivalents are indicative; ETH amount is fixed at checkout. Rate updates weekly.";

export const PLAN_PRICES = {
  free: 0,
  creator: 45_000_000,
  pro: 120_000_000,
  enterprise: 350_000_000,
};

export const PLAN_PRICE_ETH = {
  free: 0,
  creator: 45,
  pro: 120,
  enterprise: 350,
};

export const PLAN_CREDITS = {
  free: Number(import.meta.env.VITE_STUDIO_CREDIT_FREE) || 15,
  creator: Number(import.meta.env.VITE_STUDIO_CREDIT_CREATOR) || 120,
  pro: Number(import.meta.env.VITE_STUDIO_CREDIT_PRO) || 400,
  enterprise: Number(import.meta.env.VITE_STUDIO_CREDIT_ENTERPRISE) || 1500,
};

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

export const OVERAGE_PRICES = {
  lite: 500_000,
  blog: 1_000_000,
  creative: 2_500_000,
  agentic_med: 5_000_000,
  agentic_full: 15_000_000,
};

export const RUN_TYPE_LABELS = {
  prompt_single: "Prompt Generator",
  blog_draft: "Blog draft",
  workflow_ai_node: "Workflow AI node",
  workflow_creative: "Creative workflow",
  agentic_text: "Agentic text",
  agentic_images: "Agentic images",
  agentic_video: "Agentic video (Veo)",
  agentic_full: "Agentic full (video + audio)",
  clipcraft_pack: "ClipCraft pack",
};

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

export const PAID_TIERS = ["creator", "pro", "enterprise"];

/** @param {number|string|bigint} wei */
export function weiToInr(wei) {
  const eth = Number(wei) / 1e18;
  return Math.round(eth * ETH_INR_RATE);
}

/** @param {number|string|bigint} wei */
export function weiToUsd(wei) {
  const eth = Number(wei) / 1e18;
  return (eth * ETH_USD).toFixed(2);
}

/** @param {number} eth */
export function ethDisplayToInr(eth) {
  return Math.round(eth * ETH_INR_RATE);
}

/** @param {number} eth */
export function ethDisplayToUsd(eth) {
  return (eth * ETH_USD).toFixed(2);
}

export function upgradeNote(tier, userId) {
  return `sentinel_upgrade:${tier}:${userId}`;
}

export function creditExamples(pool) {
  return {
    textRuns: Math.floor(pool / CREDIT_WEIGHTS.agentic_text),
    imageRuns: Math.floor(pool / CREDIT_WEIGHTS.agentic_images),
    fullRuns: Math.floor(pool / CREDIT_WEIGHTS.agentic_full),
  };
}
