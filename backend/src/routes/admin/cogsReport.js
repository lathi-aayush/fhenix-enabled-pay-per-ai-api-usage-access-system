import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { User } from "../../models/User.js";
import { PipelineRun } from "../../models/PipelineRun.js";
import { WorkflowRun } from "../../models/WorkflowRun.js";
import { PLAN_PRICES, getPlanCredits } from "../../constants/studioPlans.js";
import { resetMonthlyCredits } from "../../services/studioCredits.js";

const router = Router();

/** Estimated Google COGS midpoints (INR) per run type. */
const COGS_INR = {
  prompt_single: 3,
  blog_draft: 4,
  workflow_ai_node: 4,
  workflow_creative: 18,
  agentic_text: 4,
  agentic_images: 35,
  agentic_video: 90,
  agentic_full: 90,
  clipcraft_pack: 18,
};

function parsePeriod(period) {
  const match = String(period || "7d").match(/^(\d+)([dhm])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  if (unit === "h") return n * 60 * 60 * 1000;
  if (unit === "m") return n * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

function requireAdmin(req, res, next) {
  const admins = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!admins.length) {
    return res.status(503).json({ error: "ADMIN_USER_IDS not configured" });
  }
  if (!admins.includes(String(req.user.userId))) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

router.get("/cogs-report", requireAuth, requireAdmin, async (req, res) => {
  const since = new Date(Date.now() - parsePeriod(req.query.period));

  const [pipelineRuns, workflowRuns, users] = await Promise.all([
    PipelineRun.find({ createdAt: { $gte: since }, status: "completed" }).lean(),
    WorkflowRun.find({ createdAt: { $gte: since } }).lean(),
    User.find({ subscriptionTier: { $ne: "free" } }).select("subscriptionTier studioOverageLog").lean(),
  ]);

  const runsByType = {};
  let estimatedCogsInr = 0;

  for (const run of pipelineRuns) {
    const chain = run.chain || [];
    let type = "agentic_text";
    if (chain.includes("video") && chain.includes("audio")) type = "agentic_full";
    else if (chain.includes("video")) type = "agentic_video";
    else if (chain.includes("image")) type = "agentic_images";
    runsByType[type] = (runsByType[type] || 0) + 1;
    estimatedCogsInr += COGS_INR[type] || 4;
  }

  for (const run of workflowRuns) {
    const type = run.runType || "workflow_ai_node";
    runsByType[type] = (runsByType[type] || 0) + 1;
    estimatedCogsInr += COGS_INR[type] || 4;
  }

  let overageRevenueMicro = 0;
  let overageCount = 0;
  for (const u of users) {
    for (const entry of u.studioOverageLog || []) {
      if (entry.timestamp && new Date(entry.timestamp) >= since && entry.settled) {
        overageRevenueMicro += entry.ethAmount || 0;
        overageCount += 1;
      }
    }
  }

  const paidUsers = users.length;
  const subscriptionRevenueMicro =
    paidUsers *
    (PLAN_PRICES.creator + PLAN_PRICES.pro + PLAN_PRICES.enterprise) /
    Math.max(1, paidUsers);

  const subscriptionRevenueMicroEstimate = users.reduce((sum, u) => {
    const tier = u.subscriptionTier || "free";
    return sum + (PLAN_PRICES[tier] || 0);
  }, 0);

  const totalRevenueMicro = subscriptionRevenueMicroEstimate + overageRevenueMicro;
  const inrPerEth = Number(process.env.ETH_USD_RATE || 0.129) * Number(process.env.INR_USD_RATE || 84.5);
  const estimatedCogsMicro = Math.round((estimatedCogsInr / inrPerEth) * 1_000_000);
  const grossMargin =
    totalRevenueMicro > 0
      ? ((totalRevenueMicro - estimatedCogsMicro) / totalRevenueMicro) * 100
      : 0;

  res.json({
    period: req.query.period || "7d",
    since,
    runsByType,
    totalRuns: pipelineRuns.length + workflowRuns.length,
    estimatedCogsInr,
    estimatedCogsMicro,
    overageRevenueMicro,
    overageRevenueEth: overageRevenueMicro / 1_000_000,
    overageCount,
    subscriptionRevenueMicroEstimate,
    subscriptionRevenueEth: subscriptionRevenueMicroEstimate / 1_000_000,
    totalRevenueMicro,
    grossMarginPercent: Number(grossMargin.toFixed(2)),
    creditPools: getPlanCredits("creator"),
  });
});

/** Refill Studio Credits to current tier pool (admin self-service). */
router.post("/refill-credits", requireAdmin, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const pool = resetMonthlyCredits(user);
  await user.save();
  res.json({
    success: true,
    tier: user.subscriptionTier,
    studioCredits: user.studioCredits,
    studioCreditPool: pool,
  });
});

/**
 * Set subscription tier (admin). Defaults to caller; optional userId for same admin tooling.
 * Body: { tier: "enterprise", userId?: "..." }
 */
router.post("/set-tier", requireAdmin, async (req, res) => {
  const tier = String(req.body?.tier || "enterprise").toLowerCase().trim();
  const valid = new Set(["free", "creator", "pro", "enterprise"]);
  if (!valid.has(tier)) {
    return res.status(400).json({ error: "Invalid tier" });
  }
  const targetId = req.body?.userId?.trim() || req.user.userId;
  const user = await User.findById(targetId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const previousTier = user.subscriptionTier || "free";
  user.subscriptionTier = tier;
  const usageResetAt = new Date();
  usageResetAt.setDate(usageResetAt.getDate() + 30);
  user.usageResetAt = usageResetAt;
  user.monthlyBlogsUsed = 0;
  user.monthlyPromptsUsed = 0;
  resetMonthlyCredits(user);
  await user.save();

  res.json({
    success: true,
    userId: user._id,
    previousTier,
    tier,
    studioCredits: user.studioCredits,
    studioCreditPool: getPlanCredits(tier),
    usageResetAt: user.usageResetAt,
  });
});

export default router;
