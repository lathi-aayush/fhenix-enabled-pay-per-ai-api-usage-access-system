import { Router } from "express";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { getPlatformStats, explorerBase } from "../services/platformStats.js";

const router = Router();

let statsCache = { at: 0, payload: null };
const CACHE_MS = 20_000;

const SUCCESS_LOG_MATCH = {
  $or: [{ success: true }, { success: { $exists: false } }],
};

function maskWallet(addr) {
  const s = String(addr ?? "").trim();
  if (!s) return null;
  if (s.length < 12) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function detectNetwork() {
  const node = (
    process.env.ALGORAND_NODE ||
    process.env.ALGOD_SERVER ||
    process.env.ALGO_INDEXER_URL ||
    ""
  ).toLowerCase();
  if (node.includes("mainnet") && !node.includes("testnet")) return "mainnet";
  return "testnet";
}

router.get("/activity", async (_req, res) => {
  try {
    const network = detectNetwork();
    const logs = await ApiUsageLog.find(SUCCESS_LOG_MATCH)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("serviceId", "title")
      .lean();

    const activities = logs.map((log) => ({
      id: String(log._id),
      maskedWallet: maskWallet(log.userWallet),
      serviceTitle: log.serviceId?.title ?? "Unknown service",
      chargeAlgo: Number(log.chargeAlgo ?? log.amountAlgo ?? 0),
      paymentTxId: log.paymentTxId ?? null,
      proofTxId: log.proofTxId ?? null,
      createdAt: log.createdAt,
      paymentExplorerUrl: log.paymentTxId
        ? `${explorerBase(network)}/tx/${log.paymentTxId}`
        : null,
      proofExplorerUrl: log.proofTxId ? `${explorerBase(network)}/tx/${log.proofTxId}` : null,
    }));

    return res.json({ network, activities });
  } catch (e) {
    console.error("[contract/activity]", e?.message || e);
    return res.status(502).json({ error: "Could not load platform activity" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (statsCache.payload && now - statsCache.at < CACHE_MS) {
      return res.json(statsCache.payload);
    }
    const payload = await getPlatformStats();
    statsCache = { at: now, payload };
    return res.json(payload);
  } catch (e) {
    console.error("[contract/stats]", e?.message || e);
    return res.status(502).json({ error: "Could not load platform stats" });
  }
});

export default router;
