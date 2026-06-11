import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import algosdk from "algosdk";
import { AccessToken } from "../models/AccessToken.js";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { User } from "../models/User.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { notifyCreatorPurchaseWebhooks } from "../services/creatorWebhookDispatcher.js";
import {
  algoToMicroAlgos,
  decodeNote,
  lookupConfirmedTransactionOnIndexer,
  normalizeAlgoAddress,
  parsePaymentFromIndexer,
} from "../services/algorandService.js";
import {
  computeChargeAlgo,
  estimateTokensFromOpenAiMessages,
  extractTokenUsage,
  microAlgosWithinTolerance,
} from "../services/billing.js";
import { registerPending, consumePending } from "../services/pendingUseCache.js";
import { forwardChatCompletion } from "../services/aiProxy.js";
import { decryptSecret } from "../utils/encrypt.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";
import { submitProofOfIntelligence } from "../services/proofOfIntelligence.js";
import {
  buildPaymentRequirements,
  send402Response,
  parseXPaymentHeader,
  verifyX402Payment,
} from "../services/x402Middleware.js";

const router = Router();

router.use((_req, res, next) => {
  res.setHeader("X-Sentinel-SDK-Version", "1.0.0");
  next();
});

const useRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
      "";
    const k = typeof raw === "string" ? raw.trim() : "";
    return k ? `k:${k.slice(0, 128)}` : `ip:${req.ip}`;
  },
});

function buildAiBody(reqBody) {
  const { txId: _t, paymentRef: _p, prompt, messages, ...rest } = reqBody || {};
  if (Array.isArray(messages) && messages.length > 0) {
    return { messages, ...rest };
  }
  if (typeof prompt === "string" && prompt.trim()) {
    return { messages: [{ role: "user", content: prompt.trim() }], ...rest };
  }
  return null;
}

function extractPromptTextFromAiBody(aiBody) {
  if (!aiBody?.messages?.length) return "";
  return aiBody.messages
    .map((m) => {
      const c = m?.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((x) => x?.text || "").join("");
      return String(c ?? "");
    })
    .join("\n")
    .trim();
}

function extractResponseTextFromAi(ar) {
  const c = ar?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  try {
    return JSON.stringify(ar ?? {});
  } catch {
    return "";
  }
}

function isUuid(s) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  );
}

async function resolveAuth(req) {
  const key =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key || typeof key !== "string") {
    return { error: 401, message: "Missing API key" };
  }
  const token = await AccessToken.findOne({ key: key.trim() });
  if (!token) {
    return { error: 401, message: "Invalid API key" };
  }
  const service = await Service.findById(token.serviceId);
  if (!service) {
    return { error: 404, message: "Service not found" };
  }
  if (service.isPaused) {
    return { error: 503, message: "Service is paused" };
  }
  if (!service.encryptedApiKey || !service.aiProvider) {
    return {
      error: 503,
      message: "Service is not configured with a live AI provider",
    };
  }
  return { token, service, key: key.trim() };
}

async function invokeFlow(req, res) {
  const aiBody = buildAiBody(req.body);
  if (!aiBody) {
    return res.status(400).json({
      error: "Provide either messages (array) or prompt (string) for the AI request",
    });
  }

  const auth = await resolveAuth(req);
  if (auth.error) {
    return res.status(auth.error).json({ error: auth.message });
  }
  const { token, service } = auth;
  const userWallet = canonicalWalletAddress(token.userWallet);
  const creatorWallet = normalizeAlgoAddress(String(service.creatorWallet || "").trim());
  if (!creatorWallet || !algosdk.isValidAddress(creatorWallet)) {
    return res.status(500).json({ error: "Service has an invalid creator wallet" });
  }

  // Calculate estimated tokens to quote the cost BEFORE calling upstream AI
  const promptTokens = estimateTokensFromOpenAiMessages(aiBody.messages);
  const estimatedCompletionTokens = Number(aiBody.max_tokens ?? 1024);
  const estimatedTotalTokens = promptTokens + estimatedCompletionTokens;

  const ppt = Number(service.pricePerThousandTokens);
  const minC = Number(service.minimumChargeAlgo);
  const chargeAlgo = computeChargeAlgo(estimatedTotalTokens, ppt, minC);
  const expectedMicroAlgos = algoToMicroAlgos(chargeAlgo);

  if (expectedMicroAlgos <= 0) {
    return res.status(500).json({ error: "Invalid computed charge for this call" });
  }

  const paymentRef = crypto.randomUUID();
  const promptText = extractPromptTextFromAiBody(aiBody);

  // Cache the full request details including prompt body in memory
  registerPending(paymentRef, {
    paymentRef,
    aiBody, // Cached prompt/messages payload to be executed once paid
    expectedMicroAlgos,
    chargeAlgo,
    promptTokens,
    completionTokens: estimatedCompletionTokens,
    totalTokens: estimatedTotalTokens,
    pricePerThousandTokens: ppt,
    minimumChargeAlgo: minC,
    serviceId: service._id,
    userWallet,
    accessTokenId: token._id,
    developerWallet: creatorWallet,
    aiProvider: service.aiProvider,
    modelName: service.modelName,
    promptText,
  });

  return res.json({
    awaitingPayment: true,
    paymentRef,
    chargeAlgo,
    expectedMicroAlgos,
    promptTokens,
    completionTokens: estimatedCompletionTokens,
    totalTokens: estimatedTotalTokens,
    pricePerThousandTokens: ppt,
    minimumChargeAlgo: minC,
    developerWallet: creatorWallet,
  });
}

async function completeFlow(req, res) {
  const txId = String(req.body?.txId || "").trim();
  const paymentRef = String(req.body?.paymentRef || "").trim();
  if (!txId) {
    return res.status(400).json({ error: "txId is required" });
  }
  if (!isUuid(paymentRef)) {
    return res.status(400).json({ error: "paymentRef must be a UUID from the quote step" });
  }

  const auth = await resolveAuth(req);
  if (auth.error) {
    return res.status(auth.error).json({ error: auth.message });
  }
  const { token, service } = auth;

  const usedOk = await ApiUsageLog.findOne({
    paymentTxId: txId,
    success: true,
  });
  if (usedOk) {
    return res.status(409).json({
      error: "This transaction has already been used",
      detail: "Each on-chain payment unlocks exactly one successful API response.",
    });
  }

  const pending = consumePending(paymentRef);
  if (!pending) {
    return res.status(410).json({
      error: "Payment session expired or unknown",
      detail: "Request a new quote with the same prompt within 60 seconds after receiving payment instructions.",
    });
  }

  if (String(pending.serviceId) !== String(service._id)) {
    return res.status(400).json({ error: "Payment session does not match this API key's service" });
  }
  const userWallet = canonicalWalletAddress(token.userWallet);
  if (normalizeAlgoAddress(pending.userWallet) !== normalizeAlgoAddress(userWallet)) {
    return res.status(400).json({ error: "Payment session does not match this wallet" });
  }

  let txInfo;
  try {
    txInfo = await lookupConfirmedTransactionOnIndexer(txId, {
      maxAttempts: 10,
      delayMs: 2000,
    });
  } catch {
    return res.status(402).json({
      error:
        "Payment not visible on the Algorand indexer yet or not confirmed. Wait a moment and try again.",
      detail:
        "The indexer can lag behind the network on TestNet; your transaction may still be valid.",
    });
  }

  const parsed = parsePaymentFromIndexer(txInfo);
  if (!parsed) {
    return res.status(400).json({ error: "Invalid transaction type (expected payment)" });
  }

  const creatorWallet = normalizeAlgoAddress(String(service.creatorWallet || "").trim());
  const { sender, receiver, amount, note } = parsed;
  const senderN = normalizeAlgoAddress(sender);
  const receiverN = normalizeAlgoAddress(receiver);
  const userN = normalizeAlgoAddress(userWallet);
  const creatorN = normalizeAlgoAddress(creatorWallet);

  // Allow any sender (like a Burner Wallet) to fund the AI request, as long as it matches the paymentRef UUID.
  if (receiverN !== creatorN) {
    return res.status(400).json({ error: "Payment receiver does not match the service developer wallet" });
  }
  if (!microAlgosWithinTolerance(Number(amount), Number(pending.expectedMicroAlgos), 1)) {
    return res.status(400).json({
      error: "Payment amount does not match the quoted charge for this call",
      detail: `Expected about ${pending.chargeAlgo} ALGO (±1%).`,
    });
  }

  const noteStr = decodeNote(note).trim();
  if (noteStr !== paymentRef) {
    return res.status(400).json({ error: "Transaction note does not match payment reference" });
  }

  // ── ON-CHAIN PAYMENT SECURED! DECRYPT KEY AND INITIATE AI RESOLUTION ──

  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    console.error("decryptSecret", e);
    return res.status(500).json({ error: "Server configuration error" });
  }

  let aiResponse;
  try {
    aiResponse = await forwardChatCompletion({
      provider: service.aiProvider,
      apiKey: providerKey,
      model: service.modelName,
      body: pending.aiBody, // Calling the AI with the cached prompt body
      customEndpointUrl: service.customEndpointUrl || "",
    });
    providerKey = null; // Clear from memory ASAP
  } catch (err) {
    providerKey = null;
    console.error("[use] complete AI invocation error:", err?.message || err);
    try {
      await ApiUsageLog.create({
        userWallet,
        serviceId: service._id,
        accessTokenId: token._id,
        developerWallet: creatorWallet,
        amountAlgo: 0,
        aiProvider: service.aiProvider,
        modelName: service.modelName,
        success: false,
        errorDetail: String(err.message || err).slice(0, 500),
      });
    } catch (logErr) {
      console.error("[use] invoke log", logErr);
    }
    const status = err.status && Number.isFinite(err.status) ? err.status : 502;
    return res.status(status).json({
      error: "Upstream AI error",
      detail: String(err.message || err).slice(0, 500),
      provider: service.aiProvider,
      model: service.modelName,
      hint:
        "Check your Marketplace listing: API key valid for this provider, model name correct, and service not paused. Run: node verify-key.js <sk-sentinel-key>",
    });
  }

  // Extract actual token usage
  let usage = extractTokenUsage(service.aiProvider, aiResponse);
  if (!usage) {
    const est = estimateTokensFromOpenAiMessages(pending.aiBody.messages);
    usage = {
      promptTokens: est,
      completionTokens: 0,
      totalTokens: est,
    };
  }

  const chargeAlgo = Number(pending.chargeAlgo);

  try {
    service.totalUses = (service.totalUses || 0) + 1;
    service.totalRevenue = Number(service.totalRevenue || 0) + chargeAlgo;
    await service.save();

    const logDoc = await ApiUsageLog.create({
      userWallet,
      serviceId: service._id,
      accessTokenId: token._id,
      developerWallet: creatorWallet,
      amountAlgo: chargeAlgo,
      aiProvider: service.aiProvider,
      modelName: service.modelName,
      paymentTxId: txId,
      paymentRef,
      success: true,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      chargeAlgo,
      pricePerThousandTokens: pending.pricePerThousandTokens,
    });

    const ts = logDoc.createdAt ? new Date(logDoc.createdAt) : new Date();
    const promptSnap = String(pending.promptText ?? "");
    const responseSnap = extractResponseTextFromAi(aiResponse);
    
    notifyCreatorPurchaseWebhooks({
      creatorWallet,
      usageLog: logDoc,
      service,
      x402Payment: false,
    });

    void (async () => {
      try {
        const proofTxId = await submitProofOfIntelligence({
          promptText: promptSnap,
          responseText: responseSnap,
          userWallet,
          serviceId: String(service._id),
          timestamp: ts.toISOString(),
        });
        if (proofTxId) {
          await ApiUsageLog.updateOne({ _id: logDoc._id }, { $set: { proofTxId } });
        }
      } catch (err) {
        console.error("[use] proof-of-intelligence async", err?.message || err);
      }
    })();

    // --- Cross-link: write a UsageRecord so gateway dashboard shows legacy calls ---
    void (async () => {
      try {
        const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
        const costCents = Math.round(chargeAlgo * rate);

        // Find the user's MongoDB _id and developer's _id for proper linking
        const consumer = await User.findOne({ walletAddress: userWallet }).select("_id").lean();
        const developer = await User.findOne({ walletAddress: creatorWallet }).select("_id").lean();

        // Find a matching ProxyApi if one exists for this service
        const proxyApi = await ProxyApi.findOne({ legacyServiceId: service._id }).select("_id").lean();

        await UsageRecord.create({
          requestId: `legacy-${paymentRef}`,
          consumerId: consumer?._id || null,
          developerId: developer?._id || null,
          apiId: proxyApi?._id || service._id,
          subscriptionId: null,
          apiKeyPrefix: auth.key?.slice(0, 12) || null,
          projectId: null,
          timestamp: ts,
          method: "POST",
          endpoint: "/api/use",
          requestStatus: "success",
          httpStatus: 200,
          responseTimeMs: null,
          tokensPrompt: pending.promptTokens || null,
          tokensCompletion: pending.completionTokens || null,
          tokensTotal: pending.totalTokens || null,
          costUnits: 1,
          costCents,
          billingStatus: "charged",
          errorMessage: null,
        });
      } catch (e) {
        // Don't fail the main response if cross-link fails
        if (e?.code !== 11000) {
          console.warn("[use] cross-link UsageRecord failed:", e?.message);
        }
      }
    })();
  } catch (logErr) {
    if (logErr?.code === 11000) {
      return res.status(409).json({
        error: "This transaction has already been used",
      });
    }
    console.error("[use] complete log finalize error", logErr);
    return res.status(500).json({ error: "Could not finalize usage log" });
  }

  return res.json({
    ...aiResponse,
    sentinelReceipt: {
      paymentTxId: txId,
      chargeAlgo,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      pricePerThousandTokens: pending.pricePerThousandTokens,
    },
  });
}

async function x402ChallengeFlow(req, res, auth) {
  const { service } = auth;
  const creatorWallet = normalizeAlgoAddress(String(service.creatorWallet || "").trim());
  if (!creatorWallet || !algosdk.isValidAddress(creatorWallet)) {
    return res.status(500).json({ error: "Service has an invalid creator wallet" });
  }

  const chargeAlgo = Number(service.minimumChargeAlgo);
  const expectedMicroAlgos = algoToMicroAlgos(chargeAlgo);
  if (expectedMicroAlgos <= 0) {
    return res.status(500).json({ error: "Invalid minimum charge for this service" });
  }

  const resource = `${req.protocol}://${req.get("host")}/api/use`;
  const paymentRequirements = buildPaymentRequirements({
    payTo: creatorWallet,
    amountMicroAlgos: expectedMicroAlgos,
    resource,
    description: `SentinelAI: ${service.title} — pay-per-use via proxy API (${chargeAlgo} ALGO)`,
  });
  return send402Response(res, paymentRequirements);
}

async function x402CompleteFlow(req, res, auth) {
  const { token, service, key } = auth;
  const userWallet = canonicalWalletAddress(token.userWallet);
  const creatorWallet = normalizeAlgoAddress(String(service.creatorWallet || "").trim());
  if (!creatorWallet || !algosdk.isValidAddress(creatorWallet)) {
    return res.status(500).json({ error: "Service has an invalid creator wallet" });
  }

  const aiBody = buildAiBody(req.body);
  if (!aiBody) {
    return res.status(400).json({
      error: "Provide either messages (array) or prompt (string) for the AI request",
    });
  }

  const paymentPayload = parseXPaymentHeader(req.headers["x-payment"]);
  if (!paymentPayload) {
    return res.status(400).json({ error: "Invalid or missing X-Payment header" });
  }

  const chargeAlgo = Number(service.minimumChargeAlgo);
  const expectedMicroAlgos = algoToMicroAlgos(chargeAlgo);

  const verification = await verifyX402Payment({
    payload: paymentPayload,
    expectedReceiver: creatorWallet,
    expectedMicroAlgos,
  });

  if (!verification.valid) {
    return res.status(402).json({
      error: "x402 payment verification failed",
      detail: verification.error,
    });
  }

  const { txId, senderAddress: payerWallet } = verification;

  const alreadyUsed = await ApiUsageLog.findOne({ paymentTxId: txId, success: true });
  if (alreadyUsed) {
    return res.status(409).json({
      error: "This transaction has already been used",
      detail: "Each on-chain payment unlocks exactly one API response.",
    });
  }

  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    console.error("[use/x402] decryptSecret", e);
    return res.status(500).json({ error: "Server configuration error" });
  }

  let aiResponse;
  try {
    aiResponse = await forwardChatCompletion({
      provider: service.aiProvider,
      apiKey: providerKey,
      model: service.modelName,
      body: aiBody,
      customEndpointUrl: service.customEndpointUrl || "",
    });
    providerKey = null;
  } catch (err) {
    providerKey = null;
    console.error("[use/x402] AI provider error:", err?.message || err);
    try {
      await ApiUsageLog.create({
        userWallet,
        serviceId: service._id,
        accessTokenId: token._id,
        developerWallet: creatorWallet,
        amountAlgo: chargeAlgo,
        aiProvider: service.aiProvider,
        modelName: service.modelName,
        paymentTxId: txId,
        success: false,
        x402Payment: true,
        errorDetail: String(err?.message || err).slice(0, 500),
      });
    } catch (logErr) {
      console.error("[use/x402] failed-call log error:", logErr);
    }
    const status = err.status && Number.isFinite(err.status) ? err.status : 502;
    return res.status(status).json({
      error: "Upstream AI provider error",
      detail: err.message || String(err),
    });
  }

  let usage = extractTokenUsage(service.aiProvider, aiResponse);
  if (!usage) {
    const est = estimateTokensFromOpenAiMessages(aiBody.messages);
    usage = { promptTokens: est, completionTokens: 0, totalTokens: est };
  }

  const actualChargeAlgo = computeChargeAlgo(
    usage.totalTokens,
    Number(service.pricePerThousandTokens),
    chargeAlgo
  );

  try {
    service.totalUses = (service.totalUses || 0) + 1;
    service.totalRevenue = Number(service.totalRevenue || 0) + chargeAlgo;
    await service.save();

    const logDoc = await ApiUsageLog.create({
      userWallet,
      serviceId: service._id,
      accessTokenId: token._id,
      developerWallet: creatorWallet,
      amountAlgo: chargeAlgo,
      aiProvider: service.aiProvider,
      modelName: service.modelName,
      paymentTxId: txId,
      success: true,
      x402Payment: true,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      chargeAlgo: actualChargeAlgo,
      pricePerThousandTokens: Number(service.pricePerThousandTokens),
    });

    notifyCreatorPurchaseWebhooks({
      creatorWallet,
      usageLog: logDoc,
      service,
      x402Payment: true,
    });

    const promptSnap = extractPromptTextFromAiBody(aiBody);
    const responseSnap = extractResponseTextFromAi(aiResponse);
    const ts = logDoc.createdAt ? new Date(logDoc.createdAt) : new Date();
    void (async () => {
      try {
        const proofTxId = await submitProofOfIntelligence({
          promptText: promptSnap,
          responseText: responseSnap,
          userWallet,
          serviceId: String(service._id),
          timestamp: ts.toISOString(),
        });
        if (proofTxId) {
          await ApiUsageLog.updateOne({ _id: logDoc._id }, { $set: { proofTxId } });
        }
      } catch (proofErr) {
        console.error("[use/x402] proof-of-intelligence error:", proofErr?.message || proofErr);
      }
    })();

    void (async () => {
      try {
        const rate = Number(process.env.ALGO_USD_CENTS_PER_ALGO || 35);
        const costCents = Math.round(chargeAlgo * rate);
        const consumer = await User.findOne({ walletAddress: userWallet }).select("_id").lean();
        const developer = await User.findOne({ walletAddress: creatorWallet }).select("_id").lean();
        const proxyApi = await ProxyApi.findOne({ legacyServiceId: service._id }).select("_id").lean();
        await UsageRecord.create({
          requestId: `x402-proxy-${txId}`,
          consumerId: consumer?._id || null,
          developerId: developer?._id || null,
          apiId: proxyApi?._id || service._id,
          subscriptionId: null,
          apiKeyPrefix: key?.slice(0, 12) || null,
          projectId: null,
          timestamp: ts,
          method: "POST",
          endpoint: "/api/use",
          requestStatus: "success",
          httpStatus: 200,
          responseTimeMs: null,
          tokensPrompt: usage.promptTokens || null,
          tokensCompletion: usage.completionTokens || null,
          tokensTotal: usage.totalTokens || null,
          costUnits: 1,
          costCents,
          billingStatus: "charged",
          errorMessage: null,
        });
      } catch (e) {
        if (e?.code !== 11000) {
          console.warn("[use/x402] cross-link UsageRecord failed:", e?.message);
        }
      }
    })();
  } catch (logErr) {
    if (logErr?.code === 11000) {
      return res.status(409).json({ error: "This transaction has already been used" });
    }
    console.error("[use/x402] usage log error:", logErr);
    return res.status(500).json({ error: "Could not finalize usage log" });
  }

  return res.json({
    ...aiResponse,
    sentinelReceipt: {
      paymentProtocol: "x402",
      paymentTxId: txId,
      payerWallet,
      chargeAlgo,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      pricePerThousandTokens: Number(service.pricePerThousandTokens),
    },
  });
}

/**
 * Without txId: quote (legacy) or x402 402 challenge.
 * With X-Payment + x402Enabled: verify payment and return AI response.
 * With txId + paymentRef: legacy complete flow.
 */
router.post("/", useRateLimit, async (req, res) => {
  const auth = await resolveAuth(req);
  if (auth.error) {
    return res.status(auth.error).json({ error: auth.message });
  }

  const { service } = auth;
  const paymentPayload = parseXPaymentHeader(req.headers["x-payment"]);

  if (service.x402Enabled) {
    if (paymentPayload) {
      return x402CompleteFlow(req, res, auth);
    }
    return x402ChallengeFlow(req, res, auth);
  }

  const txId = req.body?.txId;
  if (typeof txId === "string" && txId.trim()) {
    return completeFlow(req, res);
  }
  return invokeFlow(req, res);
});

export default router;
