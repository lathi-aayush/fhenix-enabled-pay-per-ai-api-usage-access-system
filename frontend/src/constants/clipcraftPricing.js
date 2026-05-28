/** Mirrors backend clipcraft/contracts/pricing.js */
export function estimateClipCredits(packCount, tier) {
  const n = Math.max(1, Math.floor(Number(packCount) || 1));
  let base = n >= 10 ? 12 : n * 1.5;
  if (tier === "viral") base += n * 0.2;
  return Math.round(base * 1000) / 1000;
}

export const CLIP_STATUS_LABELS = {
  queued: "Queued",
  transcribing: "Transcribing",
  analyzing: "Analyzing",
  generating_copy: "Generating copy",
  rendering: "Rendering",
  ready: "Ready",
  failed: "Failed",
};
