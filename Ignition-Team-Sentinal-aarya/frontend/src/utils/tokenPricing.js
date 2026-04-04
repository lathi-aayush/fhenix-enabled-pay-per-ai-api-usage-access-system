/** ~1.33 tokens per word (spec). */
export function wordsToApproxTokens(words) {
  const w = Number(words);
  if (!Number.isFinite(w) || w <= 0) return 0;
  return Math.ceil(w * (4 / 3));
}

export function chargeForTokens(totalTokens, pricePerThousand, minimumChargeAlgo) {
  const t = Number(totalTokens);
  const ppt = Number(pricePerThousand);
  const minC = Number(minimumChargeAlgo);
  if (!Number.isFinite(t) || t < 0) return 0;
  if (!Number.isFinite(ppt) || ppt < 0) return 0;
  if (!Number.isFinite(minC) || minC < 0) return 0;
  const raw = (t / 1000) * ppt;
  const charge = Math.max(raw, minC);
  return Math.round(charge * 1e6) / 1e6;
}

export function chargeForWords(words, pricePerThousand, minimumChargeAlgo) {
  return chargeForTokens(wordsToApproxTokens(words), pricePerThousand, minimumChargeAlgo);
}
