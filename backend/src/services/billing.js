/**
 * Token usage extraction and per-call ALGO charge for pay-per-token billing.
 */

export function estimateTokensFromOpenAiMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 1;
  let words = 0;
  for (const m of messages) {
    const c = m?.content;
    let raw = "";
    if (typeof c === "string") raw = c;
    else if (Array.isArray(c)) {
      raw = c.map((x) => (x?.type === "text" ? x.text || "" : "")).join(" ");
    } else raw = String(c ?? "");
    words += raw.trim().split(/\s+/).filter(Boolean).length;
  }
  return Math.max(1, Math.ceil(words * (4 / 3)));
}

/**
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number } | null}
 */
export function extractTokenUsage(provider, data) {
  const u = data?.usage;
  if (!u || typeof u !== "object") return null;

  if (provider === "anthropic") {
    const promptTokens = Number(u.input_tokens ?? u.inputTokens ?? 0);
    const completionTokens = Number(u.output_tokens ?? u.outputTokens ?? 0);
    const total = promptTokens + completionTokens;
    if (!Number.isFinite(total) || total <= 0) return null;
    return { promptTokens, completionTokens, totalTokens: total };
  }

  const promptTokens = Number(u.prompt_tokens ?? u.promptTokens ?? 0);
  const completionTokens = Number(u.completion_tokens ?? u.completionTokens ?? 0);
  const total = promptTokens + completionTokens;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { promptTokens, completionTokens, totalTokens: total };
}

export function computeChargeAlgo(totalTokens, pricePerThousandTokens, minimumChargeAlgo) {
  const tokens = Number(totalTokens);
  const ppt = Number(pricePerThousandTokens);
  const minC = Number(minimumChargeAlgo);
  if (!Number.isFinite(tokens) || tokens < 0) return 0;
  if (!Number.isFinite(ppt) || ppt < 0) return 0;
  if (!Number.isFinite(minC) || minC < 0) return 0;
  const raw = (tokens / 1000) * ppt;
  const charge = Math.max(raw, minC);
  return Math.round(charge * 1e6) / 1e6;
}

/** Allow 1% deviation in microAlgos; at least 1 microAlgo slack. */
export function microAlgosWithinTolerance(paidMicro, expectedMicro, tolerancePercent = 1) {
  const paid = Number(paidMicro);
  const exp = Number(expectedMicro);
  if (!Number.isFinite(paid) || !Number.isFinite(exp)) return false;
  const diff = Math.abs(paid - exp);
  const allowed = Math.max(1, Math.ceil(exp * (tolerancePercent / 100)));
  return diff <= allowed;
}
