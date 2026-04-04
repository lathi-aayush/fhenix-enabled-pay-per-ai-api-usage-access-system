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
    const creatorWallet = canonicalWalletAddress(req.user.walletAddress);
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
