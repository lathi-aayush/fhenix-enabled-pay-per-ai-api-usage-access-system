import { Router } from "express";
import { getContractConfig } from "../config/contractConfig.js";
import { readContractGlobalUints } from "../services/contractAlgod.js";

const router = Router();

let statsCache = { at: 0, payload: null };
const CACHE_MS = 20_000;

router.get("/stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (statsCache.payload && now - statsCache.at < CACHE_MS) {
      return res.json(statsCache.payload);
    }
    const cfg = getContractConfig();
    const g = await readContractGlobalUints();
    const payload = {
      appId: cfg.appId,
      contractAddress: cfg.contractAddress,
      totalPurchases: g.totalPurchases,
      totalAlgoProcessed: g.totalAlgoReceivedMicro / 1e6,
      minPaymentMicro: g.minPayment,
    };
    statsCache = { at: now, payload };
    return res.json(payload);
  } catch (e) {
    console.error("[contract/stats]", e?.message || e);
    return res.status(502).json({ error: "Could not load contract stats" });
  }
});

export default router;
