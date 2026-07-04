/**
 * Contract stats route — thin read-only stats for the SentinelPayment contract.
 *
 * GET /api/contract/stats
 */

import { Router } from "express";
import { getContractConfig } from "../config/contractConfig.js";
import { explorerAddressUrl } from "../services/evmService.js";

const router = Router();

router.get("/stats", async (req, res) => {
  const { address, chainId } = getContractConfig();
  res.json({
    contractAddress: address || null,
    chainId,
    network: "Sepolia",
    explorerUrl: address ? explorerAddressUrl(address) : null,
  });
});

export default router;
