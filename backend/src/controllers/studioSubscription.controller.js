import { User } from "../models/User.js";
import { TxRecord } from "../models/TxRecord.js";
import {
  getReceiptWithRetry,
  parseEthTransferFromTx,
  normalizeEvmAddress,
  weiToEth,
} from "../services/evmService.js";
import { getPlanPriceWei, isPaidTier, getPlanCredits } from "../constants/studioPlans.js";
import { resetMonthlyCredits } from "../services/studioCredits.js";
import { sameWallet } from "../utils/userWallet.js";

function getReceiverWallet() {
  const w = String(process.env.RECEIVER_WALLET || "").trim();
  if (!w) throw new Error("RECEIVER_WALLET is not configured on the server");
  return w;
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
      error: "Link your MetaMask wallet to this account before upgrading (Profile → Link wallet).",
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

  const requiredWei = getPlanPriceWei(tierNorm);
  if (requiredWei == null) {
    return res.status(400).json({ error: "Unknown plan price" });
  }

  let receipt;
  try {
    receipt = await getReceiptWithRetry(txIdTrim, {
      tries: 12,
      delayMs: 2000,
    });
  } catch (e) {
    return res.status(402).json({
      error: "Transaction not found or not confirmed yet. Wait a few seconds and try again.",
      detail: process.env.NODE_ENV === "development" ? e?.message : undefined,
    });
  }

  if (!receipt || receipt.status !== 1) {
    return res.status(400).json({ error: "Transaction is not confirmed on-chain" });
  }

  const parsed = await parseEthTransferFromTx(txIdTrim);
  if (!parsed) {
    return res.status(400).json({ error: "Transaction is not a payment" });
  }

  const { sender, receiver, amountWei } = parsed;
  const senderN = normalizeEvmAddress(sender);
  const receiverN = normalizeEvmAddress(receiver);
  const expectedReceiverN = normalizeEvmAddress(receiverWallet);
  const userWalletN = normalizeEvmAddress(user.walletAddress);

  if (!sameWallet(senderN, userWalletN)) {
    return res.status(400).json({ error: "Payment sender does not match your linked wallet" });
  }
  if (receiverN !== expectedReceiverN) {
    return res.status(400).json({ error: "Payment receiver does not match platform wallet" });
  }
  if (amountWei < BigInt(requiredWei)) {
    return res.status(400).json({
      error: `Insufficient payment. Required at least ${weiToEth(requiredWei)} ETH for ${tierNorm}.`,
    });
  }

  const usageResetAt = new Date();
  usageResetAt.setDate(usageResetAt.getDate() + 30);

  const previousTier = user.subscriptionTier || "free";
  user.subscriptionTier = tierNorm;

  user.usageResetAt = usageResetAt;
  user.monthlyBlogsUsed = 0;
  user.monthlyPromptsUsed = 0;
  resetMonthlyCredits(user);
  await user.save();

  console.info(
    `[studio upgrade] user=${user._id} ${previousTier}→${tierNorm} credits=${getPlanCredits(tierNorm)} resetAt=${usageResetAt.toISOString()}`
  );

  await TxRecord.create({
    txId: txIdTrim,
    userId: user._id,
    tier: tierNorm,
    amountWei: Number(amountWei),
    confirmedAt: new Date(),
  });

  res.json({
    success: true,
    tier: tierNorm,
    usageResetAt: user.usageResetAt,
    monthlyBlogsUsed: user.monthlyBlogsUsed,
    monthlyPromptsUsed: user.monthlyPromptsUsed,
    studioCredits: user.studioCredits,
    studioCreditPool: getPlanCredits(tierNorm),
  });
}
