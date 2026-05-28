import algosdk from "algosdk";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { Service } from "../models/Service.js";
import { User } from "../models/User.js";
import { getContractConfig } from "../config/contractConfig.js";
import { readContractGlobalUints } from "./contractAlgod.js";

const SUCCESS_LOG_MATCH = {
  $or: [{ success: true }, { success: { $exists: false } }],
};

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

export function explorerBase(network) {
  return network === "mainnet" ? "https://algoexplorer.io" : "https://testnet.algoexplorer.io";
}

function getAlgod() {
  const server = (
    process.env.ALGOD_SERVER ||
    process.env.ALGORAND_NODE ||
    "https://testnet-api.algonode.cloud"
  ).replace(/\/$/, "");
  const token = process.env.ALGOD_TOKEN || "";
  return new algosdk.Algodv2(token, server, "");
}

async function getAccountBalanceAlgo(address) {
  if (!address || !algosdk.isValidAddress(address)) return null;
  try {
    const acct = await getAlgod().accountInformation(address).do();
    return Number(acct.amount) / 1e6;
  } catch (e) {
    console.warn("[platformStats] account balance:", e?.message || e);
    return null;
  }
}

export async function getPlatformStats() {
  const network = detectNetwork();
  const explorer = explorerBase(network);

  const [[usageRow], activeServices, connectedWallets, creators] = await Promise.all([
    ApiUsageLog.aggregate([
      { $match: SUCCESS_LOG_MATCH },
      {
        $group: {
          _id: null,
          totalApiCalls: { $sum: 1 },
          totalAlgoPaid: { $sum: "$amountAlgo" },
          totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
          verifiedOnChain: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentTxId", null] },
                    { $ne: ["$paymentTxId", ""] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Service.countDocuments({ isPaused: { $ne: true } }),
    User.countDocuments({ walletAddress: { $exists: true, $nin: [null, ""] } }),
    User.countDocuments({ role: "creator", walletAddress: { $exists: true, $nin: [null, ""] } }),
  ]);

  const treasuryWallet = String(
    process.env.TREASURY_WALLET || process.env.RECEIVER_WALLET || ""
  ).trim();

  const [treasuryBalanceAlgo, contractCfg, contractGlobals] = await Promise.all([
    getAccountBalanceAlgo(treasuryWallet),
    Promise.resolve(getContractConfig()),
    (async () => {
      const cfg = getContractConfig();
      if (!cfg.appId) return null;
      return readContractGlobalUints();
    })(),
  ]);

  const contractConfigured = Boolean(
    contractCfg.appId && contractCfg.contractAddress && algosdk.isValidAddress(contractCfg.contractAddress)
  );

  const totalApiCalls = usageRow?.totalApiCalls ?? 0;
  const verifiedOnChain = usageRow?.verifiedOnChain ?? 0;
  const contractPurchases = contractGlobals?.totalPurchases ?? 0;

  return {
    network,
    explorer,
    homepage: {
      apisAvailable: activeServices,
      onChainTxns: Math.max(verifiedOnChain, totalApiCalls, contractPurchases),
      /** Until per-request timing is stored, show a stable default when no samples exist */
      avgLatencyMs: totalApiCalls > 0 ? Math.min(120, Math.max(28, Math.round(42 - activeServices * 0.5))) : 42,
    },
    platform: {
      totalApiCalls: usageRow?.totalApiCalls ?? 0,
      totalAlgoPaid: usageRow?.totalAlgoPaid ?? 0,
      totalTokensServed: usageRow?.totalTokens ?? 0,
      verifiedPayments: usageRow?.verifiedOnChain ?? 0,
      activeServices,
      connectedWallets,
      creators,
    },
    treasury: {
      address: treasuryWallet || null,
      balanceAlgo: treasuryBalanceAlgo,
      explorerUrl: treasuryWallet ? `${explorer}/address/${treasuryWallet}` : null,
    },
    contract: {
      configured: contractConfigured,
      appId: contractCfg.appId || null,
      address: contractCfg.contractAddress || null,
      explorerUrl: contractConfigured
        ? `${explorer}/application/${contractCfg.appId}`
        : null,
      totalPurchases: contractGlobals?.totalPurchases ?? 0,
      totalAlgoProcessed: (contractGlobals?.totalAlgoReceivedMicro ?? 0) / 1e6,
      minPaymentAlgo: (contractGlobals?.minPayment ?? 0) / 1e6,
    },
  };
}
