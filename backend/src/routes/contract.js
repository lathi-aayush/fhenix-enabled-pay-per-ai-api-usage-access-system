import { Router } from "express";
import { getPlatformStats } from "../services/platformStats.js";

const router = Router();

let statsCache = { at: 0, payload: null };
const CACHE_MS = 20_000;

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
