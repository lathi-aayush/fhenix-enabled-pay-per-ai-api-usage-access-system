/**
 * Gateway route stub — ALGO deposit/payout flow removed.
 * Retained for future EVM gateway implementation.
 *
 * GET /api/gateway/status  → current gateway config
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/status", requireAuth, (req, res) => {
  res.json({
    enabled: false,
    message: "EVM gateway coming soon. Use direct ETH payments via /api/payment.",
    network: "Base Sepolia",
    chainId: 84532,
  });
});

export default router;
