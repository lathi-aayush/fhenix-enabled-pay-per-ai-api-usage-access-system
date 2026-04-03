import { Router } from "express";
import { body, validationResult } from "express-validator";
import algosdk from "algosdk";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserBalance } from "../models/UserBalance.js";
import { WalletTopUp } from "../models/WalletTopUp.js";
import {
  algoToMicroAlgos,
  decodeNote,
  lookupTransactionByIDWithRetry,
  normalizeAlgoAddress,
  parsePaymentFromIndexer,
} from "../services/algorandService.js";

const router = Router();

function treasuryAddress() {
  const a = String(process.env.TREASURY_WALLET || "").trim();
  if (!a || !algosdk.isValidAddress(a)) {
    throw new Error("TREASURY_WALLET is not a valid Algorand address in environment");
  }
  return a;
}

router.post(
  "/topup/create",
  requireAuth,
  requireRole("user"),
  body("amountAlgo").isFloat({ gt: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    let receiver;
    try {
      receiver = treasuryAddress();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    const amountAlgo = Number(req.body.amountAlgo);
    const amountMicroAlgos = algoToMicroAlgos(amountAlgo);
    const paymentIntentId = crypto.randomUUID();
    try {
      await WalletTopUp.create({
        userWallet: String(req.user.walletAddress),
        amountAlgo,
        paymentIntentId,
        status: "pending",
      });
    } catch (e) {
      console.error("WalletTopUp.create", e);
      return res.status(500).json({ error: "Could not create top-up intent" });
    }
    res.json({
      paymentIntentId,
      receiver,
      amountMicroAlgos,
      amountAlgo,
      note: `sentinal-topup:${paymentIntentId}`,
      algodServer:
        process.env.ALGOD_SERVER ||
        process.env.ALGORAND_NODE ||
        "https://testnet-api.algonode.cloud",
    });
  }
);

router.post(
  "/topup/verify",
  requireAuth,
  requireRole("user"),
  body("txId").isString().trim().notEmpty(),
  body("paymentIntentId").isUUID(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { txId, paymentIntentId } = req.body;

    const dup = await WalletTopUp.findOne({ txId, status: "verified" });
    if (dup) {
      return res.status(409).json({ error: "Transaction already used" });
    }

    const pending = await WalletTopUp.findOne({ paymentIntentId });
    if (!pending || pending.userWallet !== req.user.walletAddress) {
      return res.status(404).json({ error: "Top-up intent not found" });
    }
    if (pending.status === "verified") {
      return res.json({
        status: "verified",
        creditedAlgo: pending.amountAlgo,
      });
    }

    let txInfo;
    try {
      txInfo = await lookupTransactionByIDWithRetry(txId);
    } catch {
      return res.status(402).json({
        error: "Transaction not found or not indexed yet. Wait a few seconds and try again.",
      });
    }

    const parsed = parsePaymentFromIndexer(txInfo);
    if (!parsed) {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    let receiver;
    try {
      receiver = treasuryAddress();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    const { sender, receiver: rcv, amount, note } = parsed;
    const expectedMicro = algoToMicroAlgos(Number(pending.amountAlgo));
    const senderN = normalizeAlgoAddress(sender);
    const receiverN = normalizeAlgoAddress(rcv);
    const userN = normalizeAlgoAddress(req.user.walletAddress);
    const treasuryN = normalizeAlgoAddress(receiver);

    if (senderN !== userN) {
      return res.status(400).json({ error: "Sender mismatch" });
    }
    if (receiverN !== treasuryN) {
      return res.status(400).json({ error: "Receiver must be platform treasury" });
    }
    if (amount !== expectedMicro) {
      return res.status(400).json({ error: "Amount mismatch" });
    }

    const noteStr = decodeNote(note);
    if (noteStr !== `sentinal-topup:${paymentIntentId}`) {
      return res.status(400).json({ error: "Note mismatch" });
    }

    const dupTx = await WalletTopUp.findOne({ txId, _id: { $ne: pending._id } });
    if (dupTx) {
      return res.status(409).json({ error: "Transaction already recorded" });
    }

    pending.txId = txId;
    pending.status = "verified";
    await pending.save();

    const creditMicro = expectedMicro;
    await UserBalance.findOneAndUpdate(
      { userWallet: req.user.walletAddress },
      { $inc: { balanceMicroAlgos: creditMicro } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const bal = await UserBalance.findOne({ userWallet: req.user.walletAddress }).lean();
    res.json({
      status: "verified",
      creditedAlgo: pending.amountAlgo,
      balanceMicroAlgos: bal?.balanceMicroAlgos ?? creditMicro,
      balanceAlgo: (bal?.balanceMicroAlgos ?? creditMicro) / 1e6,
    });
  }
);

export default router;
