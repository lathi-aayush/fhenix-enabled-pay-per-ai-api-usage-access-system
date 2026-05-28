/**
 * x402 Payment Protocol — Route Handler for SentinelAI
 *
 * Mounts at: /api/x402
 *
 * Endpoints:
 *   GET  /api/x402/services          — List all x402-enabled services
 *   POST /api/x402/use/:serviceId    — x402-gated AI call (keyless, single-round-trip)
 *
 * How the POST /api/x402/use/:serviceId flow works:
 *
 *   ROUND 1 — No X-Payment header present:
 *     → Server returns HTTP 402 with Payment-Required header containing:
 *         amount = service.minimumChargeAlgo (fixed ALGO per call)
 *         payTo  = creator wallet
 *         network = algorand-testnet
 *
 *   ROUND 2 — X-Payment header present (auto-sent by @x402/fetch or any x402 client):
 *     → Server decodes + verifies the signed Algorand tx from the header
 *     → Calls the AI provider (using existing aiProxy.js)
 *     → Writes ApiUsageLog with { x402Payment: true, userWallet: sender_of_tx }
 *     → Returns 200 + AI response + X-Payment-Response header
 *
 * Authentication: KEYLESS. The sender address extracted from the on-chain tx IS the identity.
 * No sk-sentinel-* API key is required. Payment = authentication.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { forwardChatCompletion, forwardChatCompletionStream } from "../services/aiProxy.js";
import {
  extractTokenUsage,
  estimateTokensFromOpenAiMessages,
  computeChargeAlgo,
} from "../services/billing.js";
import { algoToMicroAlgos, normalizeAlgoAddress } from "../services/algorandService.js";
import { decryptSecret } from "../utils/encrypt.js";
import { submitProofOfIntelligence } from "../services/proofOfIntelligence.js";
import {
  buildPaymentRequirements,
  send402Response,
  parseXPaymentHeader,
  verifyX402Payment,
} from "../services/x402Middleware.js";

const router = Router();

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const x402RateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // key by IP since x402 calls are keyless
    return `ip:${req.ip}`;
  },
  message: { error: "Too many requests. Maximum 30 x402 AI calls per minute per IP." },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates serviceId param and loads the service document.
 * Returns { service } on success or { error, status } on failure.
 */
async function resolveService(serviceId) {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return { error: "Invalid service ID", status: 400 };
  }
  const service = await Service.findById(serviceId);
  if (!service) {
    return { error: "Service not found", status: 404 };
  }
  if (!service.x402Enabled) {
    return {
      error: "This service has not enabled x402 payments. Use /api/use for the standard 2-step flow.",
      status: 403,
    };
  }
  if (service.isPaused) {
    return { error: "Service is currently paused", status: 503 };
  }
  if (!service.encryptedApiKey || !service.aiProvider) {
    return { error: "Service is not configured with a live AI provider", status: 503 };
  }
  if (!service.creatorWallet) {
    return { error: "Service creator wallet is not configured", status: 503 };
  }
  return { service };
}

/**
 * Normalizes the request body into an OpenAI-compatible messages array.
 * Supports both `messages` array and `prompt` string shorthand.
 */
function normalizeBody(b) {
  if (!b) return null;
  if (Array.isArray(b.messages)) {
    return { messages: b.messages, stream: b.stream };
  }
  if (typeof b.prompt === "string") {
    return { messages: [{ role: "user", content: b.prompt }], stream: b.stream };
  }
  return null;
}

/**
 * Extracts a displayable prompt string for proof-of-intelligence logging.
 */
function extractPromptText(aiBody) {
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

/**
 * Extracts AI response text for proof-of-intelligence logging.
 */
function extractResponseText(aiResponse) {
  const c = aiResponse?.choices?.[0]?.message?.content;
  return typeof c === "string" ? c : "";
}

// ─── GET /api/x402/services ─────────────────────────────────────────────────

/**
 * Returns all active services that have x402 payments enabled.
 * Public endpoint — no authentication required.
 */
router.get("/services", async (_req, res) => {
  const services = await Service.find({ x402Enabled: true, isPaused: false }).sort({ totalUses: -1 }).lean();

  const result = services
    .filter((s) => s.aiProvider && s.encryptedApiKey && s.creatorWallet)
    .map((s) => ({
      id: String(s._id),
      name: s.title,
      description: s.description || "",
      badge: s.isSentinalOfficial ? "official" : "community",
      ai_provider: s.aiProvider,
      model: s.modelName,
      creator_wallet: s.creatorWallet,
      pricing: {
        fixed_charge_algo: Number(s.minimumChargeAlgo),
        fixed_charge_micro_algos: algoToMicroAlgos(s.minimumChargeAlgo),
        billing_model: "fixed-per-call",
        note:
          "x402 calls are charged a fixed amount equal to minimumChargeAlgo per call. " +
          "For per-token pricing, use POST /api/use instead.",
      },
      usage: {
        total_calls: s.totalUses || 0,
        total_revenue_algo: Number((s.totalRevenue || 0).toFixed(6)),
      },
      x402_endpoint: `/api/x402/use/${s._id}`,
      how_to_use: {
        description:
          "Make a POST request with your messages body. If payment is required, the server returns HTTP 402. " +
          "Use @x402/fetch or any x402-compatible client to auto-pay and retry.",
        client_example: [
          "import { wrapFetchWithPayment } from '@x402/fetch';",
          "import { toClientAvmSigner } from '@x402/avm';",
          "import algosdk from 'algosdk';",
          "",
          `const account = algosdk.mnemonicToSecretKey('<your-burner-wallet-mnemonic>');`,
          "const signer = toClientAvmSigner(account.sk);",
          "const fetchWithPay = wrapFetchWithPayment(fetch, signer);",
          "",
          `const res = await fetchWithPay('http://localhost:5000/api/x402/use/${s._id}', {`,
          "  method: 'POST',",
          "  headers: { 'Content-Type': 'application/json' },",
          "  body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello!' }] })",
          "});",
          "const data = await res.json();",
          "console.log(data.choices[0].message.content);",
        ].join("\n"),
      },
    }));

  res.json({
    x402_services: true,
    network: "algorand-testnet",
    generated_at: new Date().toISOString(),
    total: result.length,
    services: result,
  });
});

// ─── POST /api/x402/use/:serviceId ──────────────────────────────────────────

/**
 * x402-gated AI call endpoint.
 *
 * Round 1 (no X-Payment header): returns HTTP 402 with payment instructions.
 * Round 2 (X-Payment header present): verifies payment, calls AI, returns response.
 */
router.post("/use/:serviceId", x402RateLimit, async (req, res) => {
  // ── 1. Resolve service ────────────────────────────────────────────────────
  const { service, error: svcError, status: svcStatus } = await resolveService(req.params.serviceId);
  if (svcError) {
    return res.status(svcStatus).json({ error: svcError });
  }

  const creatorWallet = normalizeAlgoAddress(String(service.creatorWallet).trim());
  const chargeAlgo = Number(service.minimumChargeAlgo);
  const expectedMicroAlgos = algoToMicroAlgos(chargeAlgo);

  // ── 2. Check for X-Payment header ────────────────────────────────────────
  const xPaymentHeader = req.headers["x-payment"];
  const paymentPayload = parseXPaymentHeader(xPaymentHeader);

  // ── ROUND 1: No payment header → return 402 challenge ────────────────────
  if (!paymentPayload) {
    const resource = `${req.protocol}://${req.get("host")}/api/x402/use/${service._id}`;
    const paymentRequirements = buildPaymentRequirements({
      payTo: creatorWallet,
      amountMicroAlgos: expectedMicroAlgos,
      resource,
      description: `SentinelAI: ${service.title} — pay-per-use AI API call (${chargeAlgo} ALGO)`,
    });
    return send402Response(res, paymentRequirements);
  }

  // ── ROUND 2: Payment header present → verify + call AI ───────────────────

  // 3. Verify the x402 payment on-chain
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

  const { txId, senderAddress: userWallet } = verification;

  // 4. Replay protection — check if this txId was already used
  const alreadyUsed = await ApiUsageLog.findOne({ paymentTxId: txId, success: true });
  if (alreadyUsed) {
    return res.status(409).json({
      error: "This transaction has already been used",
      detail: "Each on-chain payment unlocks exactly one x402 AI response.",
    });
  }

  // 5. Normalize the request body
  const aiBody = normalizeBody(req.body);
  if (!aiBody) {
    return res.status(400).json({
      error: "Provide either messages (array) or prompt (string) in the request body",
    });
  }

  // 6. Decrypt the creator's provider API key
  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    console.error("[x402] decryptSecret error:", e);
    return res.status(500).json({ error: "Server configuration error (could not decrypt provider key)" });
  }

  // 7. Call the AI provider
  let aiResponse;
  try {
    if (aiBody.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader(
        "X-Payment-Response",
        Buffer.from(
          JSON.stringify({
            success: true,
            txId,
            chargeAlgo,
            network: "algorand-testnet",
          })
        ).toString("base64")
      );
      res.flushHeaders();
      const streamRes = await forwardChatCompletionStream({
        provider: service.aiProvider,
        apiKey: providerKey,
        model: service.modelName,
        body: aiBody,
      }, req, res);
      providerKey = null; // clear from memory ASAP

      aiResponse = {
         choices: [{ message: { content: streamRes.content } }],
         usage: streamRes.usage
      };
      
      // Note: res is already ended by the stream, so we just run the logging logic below without sending another res.json
    } else {
      aiResponse = await forwardChatCompletion({
        provider: service.aiProvider,
        apiKey: providerKey,
        model: service.modelName,
        body: aiBody,
      });
      providerKey = null; // clear from memory ASAP
    }
  } catch (err) {
    providerKey = null;
    console.error("[x402] AI provider error:", err?.message || err);

    // Log the failed call
    try {
      await ApiUsageLog.create({
        userWallet,
        serviceId: service._id,
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
      console.error("[x402] failed-call log error:", logErr);
    }

    const status = err.status && Number.isFinite(err.status) ? err.status : 502;
    return res.status(status).json({
      error: "Upstream AI provider error",
      detail: err.message || String(err),
    });
  }

  // 8. Extract token usage for logging
  let usage = extractTokenUsage(service.aiProvider, aiResponse);
  if (!usage) {
    const est = estimateTokensFromOpenAiMessages(aiBody.messages);
    usage = { promptTokens: est, completionTokens: 0, totalTokens: est };
  }

  // 9. Compute the actual charge (for logging — billing was already the fixed minimum)
  const actualChargeAlgo = computeChargeAlgo(
    usage.totalTokens,
    Number(service.pricePerThousandTokens),
    chargeAlgo
  );

  // 10. Update service counters + write usage log
  try {
    service.totalUses = (service.totalUses || 0) + 1;
    service.totalRevenue = Number(service.totalRevenue || 0) + chargeAlgo;
    await service.save();

    const logDoc = await ApiUsageLog.create({
      userWallet,
      serviceId: service._id,
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

    // 11. Async proof-of-intelligence (fire-and-forget)
    const promptSnap = extractPromptText(aiBody);
    const responseSnap = extractResponseText(aiResponse);
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
        console.error("[x402] proof-of-intelligence error:", proofErr?.message || proofErr);
      }
    })();
  } catch (logErr) {
    if (logErr?.code === 11000) {
      return res.status(409).json({ error: "This transaction has already been used" });
    }
    console.error("[x402] usage log error:", logErr);
    return res.status(500).json({ error: "Could not finalize usage log" });
  }

  // 12. Return AI response with x402 receipt headers
  if (!res.headersSent) {
    const ai = aiResponse && typeof aiResponse === "object" ? aiResponse : {};
    return res
      .status(200)
      .set(
        "X-Payment-Response",
        Buffer.from(
          JSON.stringify({
            success: true,
            txId,
            chargeAlgo,
            network: "algorand-testnet",
          })
        ).toString("base64")
      )
      .json({
        ...ai,
        sentinelReceipt: {
          paymentProtocol: "x402",
          paymentTxId: txId,
          serviceId: service._id,
          amountAlgo: chargeAlgo,
          network: "algorand-testnet",
        },
      });
  } else {
    // If stream was used, just return (the stream has already been ended)
    return;
  }
});

export default router;
