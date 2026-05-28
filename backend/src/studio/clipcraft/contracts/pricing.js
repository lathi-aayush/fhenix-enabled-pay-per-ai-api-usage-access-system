// @filename: backend/src/studio/clipcraft/contracts/pricing.js

/** Credit pricing constants (configurable via env overrides in loadConfig) */
export const PricingDefaults = Object.freeze({
  CREDITS_PER_PACK: 1.5,
  BULK_PACK_THRESHOLD: 10,
  BULK_PACK_TOTAL_CREDITS: 12,
  VIRAL_SURCHARGE_PER_PACK: 0.2,
});

/**
 * @param {number} packCount
 * @param {"standard"|"viral"} tier
 * @param {typeof PricingDefaults} [rates]
 */
export function calculateClipJobCredits(packCount, tier, rates = PricingDefaults) {
  const n = Math.max(1, Math.floor(Number(packCount) || 1));
  let base =
    n >= rates.BULK_PACK_THRESHOLD
      ? rates.BULK_PACK_TOTAL_CREDITS
      : n * rates.CREDITS_PER_PACK;
  if (tier === "viral") {
    base += n * rates.VIRAL_SURCHARGE_PER_PACK;
  }
  return Math.round(base * 1000) / 1000;
}
