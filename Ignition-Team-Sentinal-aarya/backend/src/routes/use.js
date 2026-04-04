import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import algosdk from "algosdk";
import { AccessToken } from "../models/AccessToken.js";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
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

const router = Router();

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

  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    console.error("decryptSecret", e);
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const aiResponse = await forwardChatCompletion({
      provider: service.aiProvider,
      apiKey: providerKey,
      model: service.modelName,
      body: aiBody,
    });
    providerKey = null;

    let usage = extractTokenUsage(service.aiProvider, aiResponse);
    if (!usage) {
      const est = estimateTokensFromOpenAiMessages(aiBody.messages);
      usage = {
        promptTokens: est,
        completionTokens: 0,
        totalTokens: est,
      };
    }

    const ppt = Number(service.pricePerThousandTokens);
    const minC = Number(service.minimumChargeAlgo);
    const chargeAlgo = computeChargeAlgo(usage.totalTokens, ppt, minC);
    const expectedMicroAlgos = algoToMicroAlgos(chargeAlgo);

    if (expectedMicroAlgos <= 0) {
      return res.status(500).json({ error: "Invalid computed charge for this call" });
    }

    const paymentRef = crypto.randomUUID();
    const promptText = extractPromptTextFromAiBody(aiBody);
    const responseText = extractResponseTextFromAi(aiResponse);
    registerPending(paymentRef, {
      paymentRef,
      aiResponse,
      expectedMicroAlgos,
      chargeAlgo,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      pricePerThousandTokens: ppt,
      minimumChargeAlgo: minC,
      serviceId: service._id,
      userWallet,
      accessTokenId: token._id,
      developerWallet: creatorWallet,
      aiProvider: service.aiProvider,
      modelName: service.modelName,
      promptText,
      responseText,
    });

    return res.json({
      awaitingPayment: true,
      paymentRef,
      chargeAlgo,
      expectedMicroAlgos,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      pricePerThousandTokens: ppt,
      minimumChargeAlgo: minC,
      developerWallet: creatorWallet,
    });
  } catch (err) {
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
    console.error("[use] invoke", err?.message || err);
    return res.status(status).json({
      error: "Upstream AI error",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
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

  if (senderN !== userN) {
    return res.status(400).json({ error: "Payment sender does not match this API key's wallet" });
  }
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
      promptTokens: pending.promptTokens,
      completionTokens: pending.completionTokens,
      totalTokens: pending.totalTokens,
      chargeAlgo,
      pricePerThousandTokens: pending.pricePerThousandTokens,
    });

    const ts = logDoc.createdAt ? new Date(logDoc.createdAt) : new Date();
    const promptSnap = String(pending.promptText ?? "");
    const responseSnap = String(pending.responseText ?? "");
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
  } catch (logErr) {
    if (logErr?.code === 11000) {
      return res.status(409).json({
        error: "This transaction has already been used",
      });
    }
    console.error("[use] complete", logErr);
    return res.status(500).json({ error: "Could not finalize usage log" });
  }

  const ai = pending.aiResponse && typeof pending.aiResponse === "object" ? pending.aiResponse : {};
  return res.json({
    ...ai,
    sentinelReceipt: {
      paymentTxId: txId,
      chargeAlgo,
      promptTokens: pending.promptTokens,
      completionTokens: pending.completionTokens,
      totalTokens: pending.totalTokens,
      pricePerThousandTokens: pending.pricePerThousandTokens,
    },
  });
}

/**
 * Without txId: run AI, return payment quote (response cached, not returned).
 * With txId + paymentRef: verify payment and return cached AI response + receipt.
 */
router.post("/", useRateLimit, async (req, res) => {
  const txId = req.body?.txId;
  if (typeof txId === "string" && txId.trim()) {
    return completeFlow(req, res);
  }
  return invokeFlow(req, res);
});

export default router;
