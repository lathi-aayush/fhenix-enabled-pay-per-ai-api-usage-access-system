import { ApiUsageLog } from "../models/ApiUsageLog.js";

const TTL_MS = 60_000;
/** @type {Map<string, { timer: ReturnType<typeof setTimeout>, payload: Record<string, unknown> }>} */
const pending = new Map();

async function logPaymentTimeout(payload) {
  try {
    await ApiUsageLog.create({
      userWallet: payload.userWallet,
      serviceId: payload.serviceId,
      accessTokenId: payload.accessTokenId,
      developerWallet: payload.developerWallet,
      amountAlgo: payload.chargeAlgo,
      aiProvider: payload.aiProvider,
      modelName: payload.modelName,
      paymentRef: payload.paymentRef,
      success: false,
      errorDetail: "payment_timeout: no on-chain payment within 60s",
      promptTokens: payload.promptTokens,
      completionTokens: payload.completionTokens,
      totalTokens: payload.totalTokens,
      chargeAlgo: payload.chargeAlgo,
      pricePerThousandTokens: payload.pricePerThousandTokens,
    });
  } catch (e) {
    console.error("[pendingUse] timeout log", e);
  }
}

export function registerPending(paymentRef, payload) {
  const timer = setTimeout(() => {
    const cur = pending.get(paymentRef);
    if (!cur || cur.timer !== timer) return;
    pending.delete(paymentRef);
    void logPaymentTimeout(cur.payload);
  }, TTL_MS);
  pending.set(paymentRef, { timer, payload });
}

/** @returns {null | Record<string, unknown>} */
export function consumePending(paymentRef) {
  const p = pending.get(paymentRef);
  if (!p) return null;
  clearTimeout(p.timer);
  pending.delete(paymentRef);
  return p.payload;
}
