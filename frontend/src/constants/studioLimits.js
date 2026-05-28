/** Display limits — keep in sync with backend/src/constants/studioLimits.js */
export const PROMPT_LIMITS_BY_TIER = {
  free: 10,
  creator: 200,
  pro: null,
  enterprise: null,
};

export function promptLimitLabel(tier) {
  const n = PROMPT_LIMITS_BY_TIER[tier] ?? PROMPT_LIMITS_BY_TIER.free;
  return n == null ? "Unlimited" : `${n} / month`;
}
