import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";
import { Service } from "../models/Service.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { encryptSecret } from "../utils/encrypt.js";
import { canonicalWalletAddress, sameWallet } from "../utils/userWallet.js";

const router = Router();

const AI_PROVIDERS = ["groq", "openai", "anthropic", "together"];

export function toPublicService(doc) {
  const o =
    doc && typeof doc.toObject === "function"
      ? doc.toObject()
      : doc
        ? { ...doc }
        : null;
  if (!o) return null;
  delete o.encryptedApiKey;
  o.providerConfigured = Boolean(o.aiProvider && o.encryptedApiKey !== undefined);
  return o;
}

router.get("/", async (_req, res) => {
  const services = await Service.find().sort({ createdAt: -1 }).lean();
  res.json(
    services.map((s) => {
      const { encryptedApiKey: _e, ...rest } = s;
      return {
        ...rest,
        providerConfigured: Boolean(s.aiProvider && s.encryptedApiKey),
      };
    })
  );
});

/**
 * GET /api/services/agent-context
 * Public endpoint. Returns a structured JSON document describing all active, ready-to-use
 * AI API services on the Sentinel marketplace. Designed to be pasted directly into any
 * AI agent or LLM to help it recommend the best service for a given use-case.
 */
router.get("/agent-context", async (_req, res) => {
  const services = await Service.find({ isPaused: false })
    .sort({ totalUses: -1 })
    .lean();

  const activeServices = services
    .filter((s) => s.aiProvider && s.encryptedApiKey && s.title)
    .map((s) => ({
      id: String(s._id),
      name: s.title,
      description: s.description || "",
      badge: s.isSentinalOfficial ? "official" : "community",
      ai_provider: s.aiProvider,
      model: s.modelName,
      pricing: {
        per_1k_tokens_algo: Number(s.pricePerThousandTokens),
        minimum_charge_algo: Number(s.minimumChargeAlgo),
        billing_notes:
          "Pay-per-use via Algorand Testnet. No subscription required. " +
          "Each call is charged based on actual token usage, floored to the minimum charge.",
      },
      usage: {
        total_calls: s.totalUses || 0,
        total_revenue_algo: Number((s.totalRevenue || 0).toFixed(6)),
      },
      how_to_use: {
        step_1_generate_key: `POST /api/access/generate  body: { "serviceId": "${s._id}" }  (requires Sentinel JWT)`,
        step_2_call_api: `POST /api/use  headers: { "Authorization": "Bearer <api_key>" }  body: { "messages": [{ "role": "user", "content": "<your prompt>" }] }`,
        step_3_pay: "Respond to the returned paymentRef by sending the specified microAlgo amount on Algorand Testnet to the developerWallet address with the paymentRef in the transaction note.",
        step_4_claim: `POST /api/use  headers: { "Authorization": "Bearer <api_key>" }  body: { "txId": "<algorand_txid>", "paymentRef": "<payment_ref_uuid>" }`,
      },
      how_to_use_x402: s.x402Enabled ? {
        description: "This service supports x402 — a single-round-trip HTTP payment standard. No API key or manual wallet signing needed.",
        endpoint: `/api/x402/use/${s._id}`,
        step_1: "Send a POST request without any payment headers — server returns HTTP 402 with payment details.",
        step_2: "Your x402-compatible client (e.g. @x402/fetch) auto-pays with your burner wallet and retries.",
        step_3: "Server verifies on-chain and returns 200 + AI response.",
        client_package: "npm install @x402/fetch @x402/avm",
      } : null,
      creator_wallet: s.creatorWallet,
      last_updated: s.updatedAt,
    }));

  res.json({
    sentinel_agent_context: true,
    version: "1.0",
    generated_at: new Date().toISOString(),
    network: "algorand-testnet",
    base_url: "http://localhost:5000",
    description:
      "This is the Sentinel AI API Marketplace — a pay-per-use AI API platform built on Algorand. " +
      "Users pay micro-transactions in ALGO for each AI call. No subscriptions, no lock-in. " +
      "Use this JSON to identify which service best fits a given task and budget.",
    instructions_for_ai_agent:
      "Compare services by model, provider, pricing, and use count. " +
      "Recommend the service with the best model for the user's task at the lowest cost. " +
      "Official services (badge: 'official') are maintained by Sentinel and are the safest default. " +
      "Community services are contributed by third-party creators. " +
      "If the user wants the cheapest option, pick the lowest minimum_charge_algo. " +
      "If the user wants the best quality, prefer larger models (e.g. llama-3.3-70b, gpt-4, claude-3) at a slightly higher price.",
    total_active_services: activeServices.length,
    services: activeServices,
  });
});


router.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid service id" });
  }
  const service = await Service.findById(id).lean();
  if (!service) return res.status(404).json({ error: "Not found" });
  const { encryptedApiKey: _e, ...rest } = service;
  res.json({
    ...rest,
    providerConfigured: Boolean(service.aiProvider && service.encryptedApiKey),
  });
});

router.post(
  "/",
  requireAuth,
  requireRole("creator"),
  body("title").isString().trim().notEmpty(),
  body("description").optional().isString(),
  body("pricePerThousandTokens").isFloat({ min: 0 }),
  body("minimumChargeAlgo").isFloat({ min: 0.000001 }),
  body("aiProvider").isIn(AI_PROVIDERS),
  body("providerApiKey").isString().trim().notEmpty(),
  body("modelName").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      title,
      description = "",
      pricePerThousandTokens,
      minimumChargeAlgo,
      aiProvider,
      providerApiKey,
      modelName,
    } = req.body;
    
    let creatorWallet;
    try {
      creatorWallet = canonicalWalletAddress(req.user.walletAddress);
    } catch (e) {
      return res.status(400).json({
        error: "Creator wallet address is required to publish a service. Please click your profile avatar at the top right, scan your Pera Wallet to link it, then try again."
      });
    }

    let encryptedApiKey;
    try {
      encryptedApiKey = encryptSecret(String(providerApiKey).trim());
    } catch (e) {
      return res.status(500).json({
        error: "Could not encrypt API key. Set ENCRYPTION_KEY in the server environment.",
      });
    }
    const service = await Service.create({
      title,
      description,
      pricePerThousandTokens: Number(pricePerThousandTokens),
      minimumChargeAlgo: Number(minimumChargeAlgo),
      creatorWallet,
      aiProvider,
      encryptedApiKey,
      modelName: String(modelName).trim(),
      isPaused: false,
    });
    const { encryptedApiKey: _omit, ...safe } = service.toObject();
    res.status(201).json({
      ...safe,
      providerConfigured: true,
    });
  }
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("creator"),
  param("id").isMongoId(),
  body("title").optional().isString().trim().notEmpty(),
  body("description").optional().isString(),
  body("pricePerThousandTokens").optional().isFloat({ min: 0 }),
  body("minimumChargeAlgo").optional().isFloat({ min: 0.000001 }),
  body("modelName").optional().isString().trim().notEmpty(),
  body("aiProvider").optional().isIn(AI_PROVIDERS),
  body("providerApiKey").optional().isString().trim().notEmpty(),
  body("isPaused").optional().isBoolean(),
  body("x402Enabled").optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Not found" });
    if (!sameWallet(service.creatorWallet, req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const {
      title,
      description,
      pricePerThousandTokens,
      minimumChargeAlgo,
      modelName,
      aiProvider,
      providerApiKey,
      isPaused,
      x402Enabled,
    } = req.body;
    if (title !== undefined) service.title = title;
    if (description !== undefined) service.description = description;
    if (pricePerThousandTokens !== undefined) {
      service.pricePerThousandTokens = Number(pricePerThousandTokens);
    }
    if (minimumChargeAlgo !== undefined) {
      service.minimumChargeAlgo = Number(minimumChargeAlgo);
    }
    if (modelName !== undefined) service.modelName = modelName;
    if (aiProvider !== undefined) service.aiProvider = aiProvider;
    if (isPaused !== undefined) service.isPaused = isPaused;
    if (x402Enabled !== undefined) service.x402Enabled = x402Enabled;
    if (providerApiKey !== undefined && String(providerApiKey).trim()) {
      try {
        service.encryptedApiKey = encryptSecret(String(providerApiKey).trim());
      } catch {
        return res.status(500).json({ error: "Could not encrypt API key" });
      }
    }
    await service.save();
    const o = service.toObject();
    delete o.encryptedApiKey;
    res.json({ ...o, providerConfigured: Boolean(service.aiProvider && service.encryptedApiKey) });
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("creator"),
  param("id").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Not found" });
    if (!sameWallet(service.creatorWallet, req.user.walletAddress)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await Service.deleteOne({ _id: service._id });
    res.json({ ok: true });
  }
);

export default router;
