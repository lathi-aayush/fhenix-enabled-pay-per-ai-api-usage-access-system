/**
 * Contract stats route — read-only stats for the SentinelPayment FHE contract.
 *
 * GET /api/contract/stats
 */

import { Router } from "express";
import { getContractConfig } from "../config/contractConfig.js";
import { getNetworkConfig } from "../config/chainConfig.js";
import { explorerAddressUrl } from "../services/evmService.js";
import { getFheStatus } from "../services/fheDeductionService.js";

const router = Router();

router.get("/stats", async (req, res) => {
  const { address, chainId } = getContractConfig();
  const net = getNetworkConfig(chainId);
  const fhe = await getFheStatus();

  res.json({
    contractAddress: address || null,
    chainId,
    network: net.name,
    explorerUrl: address ? explorerAddressUrl(address) : null,
    minDepositWei: process.env.MIN_DEPOSIT_WEI || "1000000000000000",
    fhe,
  });
});

export default router;
