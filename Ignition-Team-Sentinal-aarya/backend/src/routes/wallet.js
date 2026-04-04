import { Router } from "express";
import crypto from "crypto";
import { body, validationResult } from "express-validator";
import algosdk from "algosdk";
import { TopUpIntent } from "../models/TopUpIntent.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getContractConfig } from "../config/contractConfig.js";
import { readContractGlobalUints } from "../services/contractAlgod.js";
import {
  decodeNote,
  lookupTransactionByIDWithRetry,
  normalizeAlgoAddress,
  parsePaymentFromIndexer,
} from "../services/algorandService.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

const router = Router();

router.post(
  "/topup/create",
  requireAuth,
  requireRole("user"),
  async (req, res) => {
    try {
      const { contractAddress, appId } = getContractConfig();
      if (!contractAddress || !algosdk.isValidAddress(contractAddress)) {
        return res.status(503).json({
          error: "Contract not configured",
          detail: "Deploy the Sentinel contract and set contract_info.json or ALGO_CONTRACT_ADDRESS.",
        });
      }
      let minMicro = Number(process.env.TOPUP_MIN_MICRO_ALGOS || 0);
      if (!minMicro && appId) {
        const g = await readContractGlobalUints();
        minMicro = g.minPayment || 1_000_000;
      }
      if (!minMicro) minMicro = 1_000_000;

      const userWallet = canonicalWalletAddress(req.user.walletAddress);
      const paymentIntentId = crypto.randomUUID();
      await TopUpIntent.create({
        userWallet,
        paymentIntentId,
        amountMicroAlgos: minMicro,
        status: "pending",
      });

      return res.json({
        paymentIntentId,
        receiver: contractAddress,
        amountMicroAlgos: minMicro,
        amountAlgo: minMicro / 1e6,
        note: `sentinal-topup:${paymentIntentId}`,
        algodServer:
          process.env.ALGOD_SERVER ||
          process.env.ALGORAND_NODE ||
          "https://testnet-api.algonode.cloud",
        appId: appId || undefined,
        abiHint:
          "For counters to increment on-chain, use an atomic group: Payment (to contract address) + App call purchase(). Simple pay-only tops up the app account but may not run purchase().",
      });
    } catch (e) {
      console.error("[wallet/topup/create]", e?.message || e);
      return res.status(500).json({ error: "Could not create top-up intent" });
    }
  }
);

router.post(
  "/topup/verify",
  requireAuth,
  requireRole("user"),
  body("txId").isString().trim().notEmpty(),
  body("paymentIntentId").isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { txId, paymentIntentId } = req.body;
      const { contractAddress } = getContractConfig();
      if (!contractAddress || !algosdk.isValidAddress(contractAddress)) {
        return res.status(503).json({ error: "Contract not configured" });
      }

      const userWallet = canonicalWalletAddress(req.user.walletAddress);
      const pending = await TopUpIntent.findOne({ paymentIntentId });
      if (!pending || pending.userWallet !== userWallet) {
        return res.status(404).json({ error: "Top-up intent not found" });
      }
      if (pending.status === "verified") {
        return res.json({ status: "verified", transaction: pending });
      }

      let txInfo;
      try {
        txInfo = await lookupTransactionByIDWithRetry(txId.trim());
      } catch {
        return res.status(402).json({
          error: "Transaction not found or not indexed yet",
        });
      }

      const parsed = parsePaymentFromIndexer(txInfo);
      if (!parsed) {
        return res.status(400).json({ error: "Invalid transaction type" });
      }

      const receiverN = normalizeAlgoAddress(parsed.receiver);
      const contractN = normalizeAlgoAddress(contractAddress);
      if (receiverN !== contractN) {
        return res.status(400).json({ error: "Receiver must be the Sentinel contract address" });
      }

      const amount = Number(parsed.amount);
      if (amount < Number(pending.amountMicroAlgos)) {
        return res.status(400).json({
          error: "Amount below minimum for this top-up",
        });
      }

      const senderN = normalizeAlgoAddress(parsed.sender);
      const userN = normalizeAlgoAddress(userWallet);
      if (senderN !== userN) {
        return res.status(400).json({ error: "Sender does not match your wallet" });
      }

      const noteStr = decodeNote(parsed.note).trim();
      if (noteStr !== `sentinal-topup:${paymentIntentId}`) {
        return res.status(400).json({ error: "Transaction note does not match top-up intent" });
      }

      pending.txId = txId.trim();
      pending.status = "verified";
      await pending.save();

      return res.json({ status: "verified", transaction: pending });
    } catch (e) {
      console.error("[wallet/topup/verify]", e?.message || e);
      return res.status(500).json({ error: "Verification failed" });
    }
  }
);

export default router;
