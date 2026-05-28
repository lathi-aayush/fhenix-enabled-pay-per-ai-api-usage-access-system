/** Studio tier limits — blogs, projects, prompt generator (monthly). */
export const STUDIO_TIER_LIMITS = {
  free: { blogsPerMonth: 3, maxProjects: 2, promptsPerMonth: 10 },
  creator: { blogsPerMonth: 50, maxProjects: 10, promptsPerMonth: 200 },
  pro: { blogsPerMonth: Infinity, maxProjects: Infinity, promptsPerMonth: Infinity },
  enterprise: { blogsPerMonth: Infinity, maxProjects: Infinity, promptsPerMonth: Infinity },
};

export function limitForTier(tier, key) {
  const cap = STUDIO_TIER_LIMITS[tier]?.[key];
  if (cap === Infinity) return null;
  return cap ?? STUDIO_TIER_LIMITS.free[key];
}
