import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import crypto from "crypto";
import { AccessToken } from "../models/AccessToken.js";
import { Service } from "../models/Service.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

const router = Router();

router.post(
  "/generate",
  requireAuth,
  requireRole("user"),
  body("serviceId").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { serviceId } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });
    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const existing = await AccessToken.findOne({
      userWallet,
      serviceId,
    }).sort({ createdAt: -1 });
    if (existing) {
      return res.json({ key: existing.key, createdAt: existing.createdAt });
    }
    const key = `sk-sentinel-${crypto.randomBytes(32).toString("hex")}`;
    const doc = await AccessToken.create({
      userWallet,
      serviceId,
      key,
      isUsed: false,
    });
    res.status(201).json({ key: doc.key, createdAt: doc.createdAt });
  }
);

router.get(
  "/:serviceId",
  requireAuth,
  param("serviceId").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const tokens = await AccessToken.find({
      userWallet,
      serviceId: req.params.serviceId,
    })
      .sort({ createdAt: -1 })
      .select("key isUsed createdAt")
      .lean();
    res.json(tokens);
  }
);

export default router;
