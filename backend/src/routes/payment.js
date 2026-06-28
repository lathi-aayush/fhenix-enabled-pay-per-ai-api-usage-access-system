/**
 * Payment routes — 2-step marketplace purchase flow on Base Sepolia.
 *
 * POST /api/payment/create  → returns {receiver, amountWei, amountEth, nonce}
 * POST /api/payment/verify  → checks ETH tx on-chain, issues sk-sentinel-* API key
 */

import { Router } from "express";
import { body, validationResult } from "express-validator";
import { ethers } from "ethers";
import crypto from "crypto";
import { Service } from "../models/Service.js";
import { Transaction } from "../models/Transaction.js";
import { AccessToken } from "../models/AccessToken.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { canonicalWalletAddress, sameWallet } from "../utils/userWallet.js";
import {
  getReceiptWithRetry,
  getTransaction,
  normalizeEvmAddress,
  isValidEvmAddress,
  weiWithinTolerance,
  explorerTxUrl,
} from "../services/evmService.js";

const router = Router();

router.post(
  "/create",
  requireAuth,
  requireRole("user", "creator"),
  body("serviceId").isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const serviceId = String(req.body.serviceId || "").trim();
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const receiver = String(service.creatorWallet || "").trim();
    if (!receiver || !isValidEvmAddress(receiver)) {
      return res.status(400).json({
        error: "Service has no valid payout address. Creator must update their wallet to a Base Sepolia address.",
      });
    }

    if (sameWallet(receiver, req.user.walletAddress)) {
      return res.status(400).json({ error: "Cannot pay for your own service" });
    }

    const minCharge = Number(service.minimumChargeEth);
    if (!Number.isFinite(minCharge) || minCharge <= 0) {
      return res.status(400).json({ error: "Invalid service minimum charge" });
    }

    const amountWei = ethers.parseEther(minCharge.toFixed(18)).toString();
    const paymentIntentId = crypto.randomUUID();
    const userWallet = canonicalWalletAddress(req.user.walletAddress);

    try {
      await Transaction.create({
        userWallet,
        serviceId: service._id,
        amount: minCharge,
        status: "pending",
        paymentIntentId,
      });
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({ error: "Duplicate payment record. Try again in a moment." });
      }
      return res.status(500).json({ error: "Could not create payment intent" });
    }

    res.json({
      paymentIntentId,
      receiver: normalizeEvmAddress(receiver),
      amountWei,
      amountEth: minCharge,
      nonce: `sentinal:${paymentIntentId}`,
      network: "Base Sepolia",
      chainId: 84532,
      rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
    });
  }
);

router.post(
  "/verify",
  requireAuth,
  requireRole("user", "creator"),
  body("txHash").isString().trim().notEmpty(),
  body("paymentIntentId").isUUID(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { txHash, paymentIntentId } = req.body;

    const existing = await Transaction.findOne({ txId: txHash });
    if (existing?.status === "verified") {
      return res.status(409).json({ error: "Transaction already used" });
    }

    const userWallet = canonicalWalletAddress(req.user.walletAddress);
    const pending = await Transaction.findOne({ paymentIntentId });
    if (!pending || !sameWallet(pending.userWallet, userWallet)) {
      return res.status(404).json({ error: "Payment intent not found" });
    }

    if (pending.status === "verified") {
      const tokenDoc = await AccessToken.findOne({
        userWallet,
        serviceId: pending.serviceId,
      }).sort({ createdAt: -1 });
      return res.json({ status: "verified", apiKey: tokenDoc?.key ?? null, transaction: pending });
    }

    // Wait for on-chain confirmation
    let receipt;
    try {
      receipt = await getReceiptWithRetry(txHash.trim());
    } catch {
      return res.status(402).json({
        error: "Transaction not found or not confirmed yet. Wait a few seconds and try again.",
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction reverted on-chain" });
    }

    const tx = await getTransaction(txHash.trim());
    if (!tx) return res.status(400).json({ error: "Could not fetch transaction details" });

    const service = await Service.findById(pending.serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const expectedWei = ethers.parseEther(Number(service.minimumChargeEth).toFixed(18));
    const senderNorm = normalizeEvmAddress(tx.from);
    const receiverNorm = normalizeEvmAddress(tx.to);
    const userNorm = normalizeEvmAddress(userWallet);
    const creatorNorm = normalizeEvmAddress(service.creatorWallet);

    if (senderNorm !== userNorm) {
      return res.status(400).json({ error: "Sender does not match your wallet" });
    }
    if (receiverNorm !== creatorNorm) {
      return res.status(400).json({ error: "Receiver does not match service creator wallet" });
    }
    if (!weiWithinTolerance(tx.value, expectedWei, 1)) {
      return res.status(400).json({ error: "Payment amount does not match service price" });
    }

    const dupTx = await Transaction.findOne({ txId: txHash, _id: { $ne: pending._id } });
    if (dupTx) {
      return res.status(409).json({ error: "Transaction already recorded" });
    }

    pending.txId = txHash.trim();
    pending.status = "verified";
    await pending.save();

    service.totalRevenue = Number(service.totalRevenue) + Number(service.minimumChargeEth);
    await service.save();

    const apiKey = `sk-sentinel-${crypto.randomBytes(32).toString("hex")}`;
    await AccessToken.create({
      userId: req.user.userId,
      userWallet,
      serviceId: service._id,
      key: apiKey,
      isUsed: false,
    });

    res.json({
      status: "verified",
      apiKey,
      serviceId: service._id.toString(),
      txHash: txHash.trim(),
      explorerUrl: explorerTxUrl(txHash.trim()),
    });
  }
);

export default router;
