/**
 * Wallet/contract top-up routes for Sepolia SentinelPayment contract.
 *
 * POST /api/wallet/topup/create  â†’ returns deposit params for the contract
 * POST /api/wallet/topup/verify  â†’ confirms ETH deposit on-chain
 */

import { Router } from "express";
import crypto from "crypto";
import { body, validationResult } from "express-validator";
import { ethers } from "ethers";
import { TopUpIntent } from "../models/TopUpIntent.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getContractConfig } from "../config/contractConfig.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";
import {
  getReceiptWithRetry,
  normalizeEvmAddress,
  isValidEvmAddress,
  explorerTxUrl,
} from "../services/evmService.js";

const router = Router();

router.post(
  "/topup/create",
  requireAuth,
  requireRole("user", "creator"),
  async (req, res) => {
    try {
      const { address: contractAddress } = getContractConfig();
      if (!contractAddress || !isValidEvmAddress(contractAddress)) {
        return res.status(503).json({
          error: "Contract not configured",
          detail: "Deploy SentinelPayment.sol and set CONTRACT_ADDRESS in .env",
        });
      }

      // 0.001 ETH default minimum deposit
      const minWei = BigInt(process.env.MIN_DEPOSIT_WEI || "1000000000000000");

      const userWallet = canonicalWalletAddress(req.user.walletAddress);
      const paymentIntentId = crypto.randomUUID();

      await TopUpIntent.create({
        userWallet,
        paymentIntentId,
        amountWei: minWei.toString(), // reusing field name, now stores wei
        status: "pending",
      });

      return res.json({
        paymentIntentId,
        contractAddress: normalizeEvmAddress(contractAddress),
        amountWei: minWei.toString(),
        amountEth: ethers.formatEther(minWei),
        network: "Sepolia",
        chainId: 11155111,
        rpcUrl: process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
        hint: "Call SentinelPayment.deposit({ value: amountWei }) to top up your encrypted balance.",
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
  requireRole("user", "creator"),
  body("txHash").isString().trim().notEmpty(),
  body("paymentIntentId").isUUID(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { txHash, paymentIntentId } = req.body;
      const { address: contractAddress } = getContractConfig();
      if (!contractAddress || !isValidEvmAddress(contractAddress)) {
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

      let receipt;
      try {
        receipt = await getReceiptWithRetry(txHash.trim());
      } catch {
        return res.status(402).json({ error: "Transaction not found or not confirmed yet" });
      }

      if (receipt.status !== 1) {
        return res.status(400).json({ error: "Transaction reverted on-chain" });
      }

      // Verify tx was sent to the contract address
      if (receipt.to && normalizeEvmAddress(receipt.to) !== normalizeEvmAddress(contractAddress)) {
        return res.status(400).json({ error: "Transaction receiver must be the SentinelPayment contract address" });
      }

      pending.txId = txHash.trim();
      pending.status = "verified";
      await pending.save();

      return res.json({
        status: "verified",
        transaction: pending,
        explorerUrl: explorerTxUrl(txHash.trim()),
      });
    } catch (e) {
      console.error("[wallet/topup/verify]", e?.message || e);
      return res.status(500).json({ error: "Verification failed" });
    }
  }
);

export default router;
