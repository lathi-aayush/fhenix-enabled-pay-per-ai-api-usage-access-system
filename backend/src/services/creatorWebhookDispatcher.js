import crypto from "crypto";
import { CreatorWebhook } from "../models/CreatorWebhook.js";
import { WebhookDelivery } from "../models/WebhookDelivery.js";

const RETRY_DELAYS_MS = [1000, 5000, 15000];
const REQUEST_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signPayload(secret, timestamp, body) {
  const signed = `${timestamp}.${body}`;
  return crypto.createHmac("sha256", secret).update(signed).digest("hex");
}

function buildPurchasePayload({ usageLog, service, x402Payment }) {
  return {
    usageLogId: String(usageLog._id),
    serviceId: String(service._id),
    serviceTitle: service.title ?? null,
    userWallet: usageLog.userWallet,
    developerWallet: usageLog.developerWallet,
    chargeEth: Number(usageLog.chargeEth ?? usageLog.amountEth),
    amountEth: Number(usageLog.amountEth),
    promptTokens: usageLog.promptTokens ?? null,
    completionTokens: usageLog.completionTokens ?? null,
    totalTokens: usageLog.totalTokens ?? null,
    paymentTxId: usageLog.paymentTxId ?? null,
    paymentRef: usageLog.paymentRef ?? null,
    x402Payment: Boolean(x402Payment ?? usageLog.x402Payment),
    aiProvider: usageLog.aiProvider ?? null,
    modelName: usageLog.modelName ?? null,
    createdAt: usageLog.createdAt ? new Date(usageLog.createdAt).toISOString() : new Date().toISOString(),
  };
}

async function postWebhook(webhook, envelope) {
  const body = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(webhook.secret, timestamp, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SentinelAI-Webhooks/1.0",
        "X-Sentinel-Event": envelope.event,
        "X-Sentinel-Signature": `t=${timestamp},v1=${signature}`,
        "X-Sentinel-Delivery-Id": envelope.id,
      },
      body,
      signal: controller.signal,
    });

    if (res.ok) {
      return { success: true, httpStatus: res.status };
    }
    const text = await res.text().catch(() => "");
    return {
      success: false,
      httpStatus: res.status,
      errorMessage: text.slice(0, 500) || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      success: false,
      errorMessage: err?.name === "AbortError" ? "Request timed out" : String(err?.message || err).slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function deliverWithRetries(webhook, envelope) {
  let lastResult = { success: false, errorMessage: "No attempts" };
  let attemptCount = 0;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    attemptCount += 1;
    lastResult = await postWebhook(webhook, envelope);
    if (lastResult.success) break;
    if (i < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[i]);
    }
  }

  return { ...lastResult, attemptCount };
}

async function recordDelivery(webhook, envelope, result) {
  await WebhookDelivery.create({
    webhookId: webhook._id,
    creatorWallet: webhook.creatorWallet,
    event: envelope.event,
    url: webhook.url,
    success: result.success,
    httpStatus: result.httpStatus,
    errorMessage: result.errorMessage,
    attemptCount: result.attemptCount,
    payloadId: envelope.id,
  });

  await CreatorWebhook.updateOne(
    { _id: webhook._id },
    {
      $set: {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: result.success ? "success" : "failed",
      },
    }
  );
}

/**
 * Fire registered creator webhooks for a successful API purchase.
 * Non-blocking — errors are logged, never thrown to callers.
 */
export function notifyCreatorPurchaseWebhooks({ creatorWallet, usageLog, service, x402Payment = false }) {
  void (async () => {
    try {
      const wallet = String(creatorWallet || "").trim();
      if (!wallet || !usageLog?._id) return;

      const webhooks = await CreatorWebhook.find({
        creatorWallet: wallet,
        enabled: true,
        events: "api.purchase.completed",
      }).lean();

      if (webhooks.length === 0) return;

      const payloadId = `evt_${crypto.randomUUID()}`;
      const envelope = {
        id: payloadId,
        event: "api.purchase.completed",
        createdAt: new Date().toISOString(),
        data: buildPurchasePayload({ usageLog, service, x402Payment }),
      };

      await Promise.all(
        webhooks.map(async (wh) => {
          const result = await deliverWithRetries(wh, envelope);
          await recordDelivery(wh, envelope, result);
          if (!result.success) {
            console.error(
              `[webhook] delivery failed webhook=${wh._id} status=${result.httpStatus ?? "—"} ${result.errorMessage ?? ""}`
            );
          }
        })
      );
    } catch (err) {
      console.error("[webhook] notifyCreatorPurchaseWebhooks", err?.message || err);
    }
  })();
}

/** Send a test ping to a single registered webhook (awaited). */
export async function sendTestWebhook(webhook) {
  const payloadId = `test_${crypto.randomUUID()}`;
  const envelope = {
    id: payloadId,
    event: "webhook.test",
    createdAt: new Date().toISOString(),
    data: {
      message: "SentinelAI webhook test — your endpoint is reachable.",
      creatorWallet: webhook.creatorWallet,
    },
  };

  const result = await deliverWithRetries(webhook, envelope);
  await recordDelivery(webhook, envelope, result);
  return result;
}

export function maskWebhookSecret(secret) {
  if (!secret || secret.length < 8) return "••••••••";
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}
