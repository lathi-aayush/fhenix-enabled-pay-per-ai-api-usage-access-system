import { User } from "../models/User.js";
import { TxRecord } from "../models/TxRecord.js";
import {
  decodeNote,
  indexerTransactionConfirmedRound,
  lookupConfirmedTransactionOnIndexer,
  normalizeAlgoAddress,
  parsePaymentFromIndexer,
} from "../services/algorandService.js";
import { getPlanPriceMicro, isPaidTier } from "../constants/studioPlans.js";
import { sameWallet } from "../utils/userWallet.js";

function getReceiverWallet() {
  const w = String(process.env.RECEIVER_WALLET || "").trim();
  if (!w) throw new Error("RECEIVER_WALLET is not configured on the server");
  return w;
}

function expectedUpgradeNote(tier, userId) {
  return `sentinel_upgrade:${tier}:${userId}`;
}

export async function postSubscriptionUpgrade(req, res) {
  if (!process.env.RECEIVER_WALLET?.trim()) {
    console.error("[upgrade] RECEIVER_WALLET is not set in environment");
    return res.status(500).json({ error: "Server misconfiguration: RECEIVER_WALLET not set" });
  }

  const { txId, tier } = req.body;
  const txIdTrim = String(txId || "").trim();
  const tierNorm = String(tier || "").toLowerCase().trim();

  if (!txIdTrim) {
    return res.status(400).json({ error: "txId is required" });
  }
  if (!isPaidTier(tierNorm)) {
    return res.status(400).json({ error: "Invalid tier. Must be creator, pro, or enterprise." });
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!user.walletAddress) {
    return res.status(400).json({
      error: "Link your Pera wallet to this account before upgrading (Profile → Link wallet).",
    });
  }

  const existingTx = await TxRecord.findOne({ txId: txIdTrim });
  if (existingTx) {
    return res.status(409).json({ error: "Transaction already used for an upgrade" });
  }

  let receiverWallet;
  try {
    receiverWallet = getReceiverWallet();
  } catch (e) {
    console.error("[upgrade]", e.message);
    return res.status(500).json({ error: "Server misconfiguration: RECEIVER_WALLET not set" });
  }

  const requiredMicro = getPlanPriceMicro(tierNorm);
  if (requiredMicro == null) {
    return res.status(400).json({ error: "Unknown plan price" });
  }

  let txInfo;
  try {
    txInfo = await lookupConfirmedTransactionOnIndexer(txIdTrim, {
      maxAttempts: 12,
      delayMs: 2000,
    });
  } catch (e) {
    return res.status(402).json({
      error: "Transaction not found or not confirmed yet. Wait a few seconds and try again.",
      detail: process.env.NODE_ENV === "development" ? e?.message : undefined,
    });
  }

  const confirmedRound = indexerTransactionConfirmedRound(txInfo);
  if (!confirmedRound) {
    return res.status(400).json({ error: "Transaction is not confirmed on-chain" });
  }

  const parsed = parsePaymentFromIndexer(txInfo);
  if (!parsed) {
    return res.status(400).json({ error: "Transaction is not a payment" });
  }

  const { sender, receiver, amount, note } = parsed;
  const senderN = normalizeAlgoAddress(sender);
  const receiverN = normalizeAlgoAddress(receiver);
  const expectedReceiverN = normalizeAlgoAddress(receiverWallet);
  const userWalletN = normalizeAlgoAddress(user.walletAddress);

  if (!sameWallet(senderN, userWalletN)) {
    return res.status(400).json({ error: "Payment sender does not match your linked wallet" });
  }
  if (receiverN !== expectedReceiverN) {
    return res.status(400).json({ error: "Payment receiver does not match platform wallet" });
  }
  if (Number(amount) < requiredMicro) {
    return res.status(400).json({
      error: `Insufficient payment. Required at least ${requiredMicro / 1e6} ALGO for ${tierNorm}.`,
    });
  }

  const noteStr = decodeNote(note);
  const expectedNote = expectedUpgradeNote(tierNorm, user._id.toString());
  if (noteStr !== expectedNote) {
    return res.status(400).json({ error: "Transaction note mismatch" });
  }

  const usageResetAt = new Date();
  usageResetAt.setDate(usageResetAt.getDate() + 30);

  user.subscriptionTier = tierNorm;
  user.usageResetAt = usageResetAt;
  user.monthlyBlogsUsed = 0;
  user.monthlyPromptsUsed = 0;
  await user.save();

  await TxRecord.create({
    txId: txIdTrim,
    userId: user._id,
    tier: tierNorm,
    amountMicroAlgo: Number(amount),
    confirmedAt: new Date(),
  });

  res.json({
    success: true,
    tier: tierNorm,
    usageResetAt: user.usageResetAt,
    monthlyBlogsUsed: user.monthlyBlogsUsed,
    monthlyPromptsUsed: user.monthlyPromptsUsed,
  });
}
