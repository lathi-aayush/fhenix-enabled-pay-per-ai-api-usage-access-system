import { assertBlogQuota, assertPromptQuota, ensureUsageMonth } from "../services/blog.service.js";
import { limitForTier } from "../constants/studioLimits.js";

/** Expects req.user.userId from requireAuth */
export async function checkBlogQuota(req, res, next) {
  try {
    await assertBlogQuota(req.user.userId);
    next();
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ error: e.message || "Quota check failed" });
  }
}

export async function checkPromptQuota(req, res, next) {
  try {
    await assertPromptQuota(req.user.userId);
    next();
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ error: e.message || "Quota check failed" });
  }
}

export async function attachUsageSummary(req, res, next) {
  try {
    const user = await ensureUsageMonth(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    req.usageUser = user;
    const tier = user.subscriptionTier || "free";
    const blogCap = limitForTier(tier, "blogsPerMonth");
    const promptCap = limitForTier(tier, "promptsPerMonth");
    req.blogQuota = {
      used: user.monthlyBlogsUsed || 0,
      limit: blogCap,
      tier,
    };
    req.promptQuota = {
      used: user.monthlyPromptsUsed || 0,
      limit: promptCap,
      tier,
    };
    next();
  } catch (e) {
    next(e);
  }
}
