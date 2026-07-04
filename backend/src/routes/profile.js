import { Router } from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { User } from "../models/User.js";
import { Service } from "../models/Service.js";
import { AccessToken } from "../models/AccessToken.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { LedgerTransaction } from "../models/LedgerTransaction.js";
import { DeveloperEarning } from "../models/DeveloperEarning.js";
import { requireAuth } from "../middleware/auth.js";
import { encryptSecret, decryptSecret } from "../utils/encrypt.js";
import { getBalanceCents } from "../services/gatewayBalanceService.js";

const router = Router();

const RATE = () => Number(process.env.ETH_USD_RATE || 35);

function normalizePrivateKey(raw) {
  const key = String(raw || "").trim();
  if (!key) return "";
  return key.startsWith("0x") ? key : `0x${key}`;
}

/**
 * GET /api/profile/summary
 * Retrieves Google profile info, linked wallet, creator APIs, and user usage history.
 * Merges legacy ApiUsageLog data with gateway UsageRecord data for a unified view.
 */
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const rate = RATE();
    const userId = user._id;

    const responseData = {
      profile: {
        id: userId,
        email: user.email || null,
        displayName: user.displayName || "Google User",
        photoURL: user.photoURL || "https://lh3.googleusercontent.com/a/default-user",
        role: user.role,
        walletAddress: user.walletAddress || null,
        createdAt: user.createdAt,
      },
      creatorSummary: null,
      userSummary: null,
      gatewaySummary: null,
    };

    const walletAddress = user.walletAddress;

    // ——— Gateway summary (always available, even without wallet) ———
    try {
      const balanceCents = await getBalanceCents(userId);

      const [gatewayUsageAgg, recentGatewayLogs, subscriptions, recentTx] = await Promise.all([
        UsageRecord.aggregate([
          { $match: { consumerId: userId, billingStatus: "charged" } },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: 1 },
              totalCostCents: { $sum: "$costCents" },
              totalTokens: { $sum: { $ifNull: ["$tokensTotal", 0] } },
            },
          },
        ]),
        UsageRecord.find({ consumerId: userId })
          .sort({ timestamp: -1 })
          .limit(15)
          .populate("apiId", "name proxySlug category")
          .lean(),
        GatewaySubscription.find({ consumerId: userId, isActive: true })
          .populate("apiId", "name proxySlug pricePerUnit pricingModel")
          .lean(),
        LedgerTransaction.find({ userId })
          .sort({ createdAt: -1 })
          .limit(15)
          .lean(),
      ]);

      const gwAgg = gatewayUsageAgg[0] || {};
      responseData.gatewaySummary = {
        balanceCents,
        balanceEth: balanceCents / rate,
        totalCalls: gwAgg.totalCalls || 0,
        totalSpentCents: gwAgg.totalCostCents || 0,
        totalSpentEth: (gwAgg.totalCostCents || 0) / rate,
        totalTokens: gwAgg.totalTokens || 0,
        activeSubscriptions: subscriptions.length,
        subscriptions: subscriptions.map((s) => ({
          id: s._id,
          apiName: s.apiId?.name,
          proxySlug: s.apiId?.proxySlug,
          pricePerUnitCents: s.apiId?.pricePerUnit,
          pricePerUnitEth: (s.apiId?.pricePerUnit || 0) / rate,
          pricingModel: s.apiId?.pricingModel,
        })),
        recentLogs: recentGatewayLogs.map((l) => ({
          id: l._id,
          requestId: l.requestId,
          apiName: l.apiId?.name,
          proxySlug: l.apiId?.proxySlug,
          timestamp: l.timestamp,
          method: l.method,
          httpStatus: l.httpStatus,
          costCents: l.costCents,
          costEth: (l.costCents || 0) / rate,
          tokensTotal: l.tokensTotal,
          requestStatus: l.requestStatus,
          responseTimeMs: l.responseTimeMs,
        })),
        recentTransactions: recentTx.map((tx) => ({
          ...tx,
          amountEth: (tx.amountCents || 0) / rate,
        })),
      };
    } catch (e) {
      console.warn("[profile-summary] gateway data failed:", e?.message);
    }

    // ——— Gateway developer earnings (for creators) ———
    if (user.role === "creator") {
      try {
        const [devEarningsAgg, proxyApis] = await Promise.all([
          DeveloperEarning.aggregate([
            { $match: { developerId: userId } },
            {
              $group: {
                _id: "$status",
                total: { $sum: "$earningCents" },
                count: { $sum: 1 },
              },
            },
          ]),
          ProxyApi.find({ developerId: userId }).select("-authHeaderEncrypted").lean(),
        ]);

        const earningsByStatus = Object.fromEntries(devEarningsAgg.map((r) => [r._id, r.total]));
        responseData.creatorSummary = responseData.creatorSummary || {};
        responseData.creatorSummary.gatewayEarnings = {
          availableCents: earningsByStatus.available || 0,
          availableEth: (earningsByStatus.available || 0) / rate,
          paidOutCents: earningsByStatus.paid_out || 0,
          paidOutEth: (earningsByStatus.paid_out || 0) / rate,
          proxyApiCount: proxyApis.length,
          proxyApis: proxyApis.map((a) => ({
            id: a._id,
            name: a.name,
            proxySlug: a.proxySlug,
            pricePerUnit: a.pricePerUnit,
            pricingModel: a.pricingModel,
            callCount: a.callCount,
            isActive: a.isActive,
          })),
        };
      } catch (e) {
        console.warn("[profile-summary] gateway creator data failed:", e?.message);
      }
    }

    // ——— Legacy stats (only if wallet connected) ———
    if (walletAddress) {
      try {
        if (user.role === "creator") {
          const services = await Service.find({ creatorWallet: walletAddress });
          
          let totalRevenue = 0;
          let totalUses = 0;
          services.forEach((s) => {
            totalRevenue += s.totalRevenue || 0;
            totalUses += s.totalUses || 0;
          });

          const recentSales = await ApiUsageLog.find({ developerWallet: walletAddress })
            .populate("serviceId", "title")
            .sort({ createdAt: -1 })
            .limit(10);

          responseData.creatorSummary = {
            ...(responseData.creatorSummary || {}),
            servicesCount: services.length,
            totalRevenue,
            totalUses,
            services: services.map((s) => ({
              id: s._id,
              title: s.title,
              description: s.description,
              pricePerThousandTokens: s.pricePerThousandTokens,
              minimumChargeEth: s.minimumChargeEth,
              totalRevenue: s.totalRevenue,
              totalUses: s.totalUses,
              aiProvider: s.aiProvider,
              modelName: s.modelName,
              isPaused: s.isPaused,
            })),
            recentSales: recentSales.map((log) => ({
              id: log._id,
              userWallet: log.userWallet,
              serviceTitle: log.serviceId?.title || "Unknown API",
              amountEth: log.amountEth || log.chargeEth || 0,
              promptTokens: log.promptTokens || 0,
              completionTokens: log.completionTokens || 0,
              success: log.success,
              createdAt: log.createdAt,
            })),
          };
        }

        // User Statistics
        const purchasedKeys = await AccessToken.find({ userWallet: walletAddress })
          .populate("serviceId", "title description pricePerThousandTokens minimumChargeEth aiProvider modelName");

        const recentCalls = await ApiUsageLog.find({ userWallet: walletAddress })
          .populate("serviceId", "title")
          .sort({ createdAt: -1 })
          .limit(10);

        const allLogs = await ApiUsageLog.find({ userWallet: walletAddress, success: true });
        let totalSpent = 0;
        let totalTokens = 0;
        allLogs.forEach((log) => {
          totalSpent += log.amountEth || log.chargeEth || 0;
          totalTokens += log.totalTokens || 0;
        });

        responseData.userSummary = {
          totalSpent,
          totalCalls: allLogs.length,
          totalTokens,
          activeKeys: purchasedKeys.map((token) => ({
            id: token._id,
            key: token.key,
            isUsed: token.isUsed,
            service: token.serviceId ? {
              id: token.serviceId._id,
              title: token.serviceId.title,
              description: token.serviceId.description,
              aiProvider: token.serviceId.aiProvider,
              modelName: token.serviceId.modelName,
              pricePerThousandTokens: token.serviceId.pricePerThousandTokens,
              minimumChargeEth: token.serviceId.minimumChargeEth,
            } : null,
          })),
          recentCalls: recentCalls.map((log) => ({
            id: log._id,
            serviceTitle: log.serviceId?.title || "Unknown API",
            amountEth: log.amountEth || log.chargeEth || 0,
            totalTokens: log.totalTokens || 0,
            success: log.success,
            createdAt: log.createdAt,
            paymentTxId: log.paymentTxId,
            proofTxId: log.proofTxId,
          })),
        };
      } catch (e) {
        console.warn("[profile-summary] legacy data failed:", e?.message);
      }
    }

    res.json(responseData);
  } catch (e) {
    console.error("[profile-summary] error:", e.message);
    res.status(500).json({ error: "Failed to load profile summary stats" });
  }
});

/**
 * PUT /api/profile
 * Updates the user's displayName in their profile
 */
router.put("/", requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || !String(displayName).trim()) {
      return res.status(400).json({ error: "Display name is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    user.displayName = String(displayName).trim();
    await user.save();

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });

    // Generate updated JWT with new displayName
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        walletAddress: user.walletAddress || null,
        role: user.role,
        displayName: user.displayName,
        email: user.email || "",
        photoURL: user.photoURL || "",
      },
      secret,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress || null,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("[update-profile] error:", e.message);
    res.status(500).json({ error: "Failed to update profile name" });
  }
});

/**
 * GET /api/profile/burner
 * Fetch the user's synced burner wallet mnemonic
 */
router.get("/burner", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      console.warn("[GET /burner] user not found for id:", req.user.userId);
      return res.json({ mnemonic: null });
    }
    
    if (!user.sessionKeyEncrypted) {
      return res.json({ mnemonic: null });
    }
    
    try {
      const mnemonic = decryptSecret(user.sessionKeyEncrypted);
      return res.json({ mnemonic });
    } catch (err) {
      return res.json({ mnemonic: null, error: "Failed to decrypt" });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch burner wallet" });
  }
});

/**
 * POST /api/profile/burner
 * Sync a new burner wallet mnemonic to the user's profile
 */
router.post("/burner", requireAuth, async (req, res) => {
  try {
    const { mnemonic } = req.body;
    console.log("[POST /burner] userId:", req.user?.userId, "mnemonic present:", !!mnemonic);
    if (!mnemonic || typeof mnemonic !== "string") {
      return res.status(400).json({ error: "Valid mnemonic is required" });
    }
    
    const user = await User.findById(req.user.userId);
    console.log("[POST /burner] user found:", !!user);
    if (!user) {
      // User not found - this can happen in edge cases during initial setup.
      // Return success silently so the frontend doesn't show an error.
      console.warn("[POST /burner] user not found for id:", req.user.userId, "- silently skipping");
      return res.json({ success: true, skipped: true });
    }
    
    user.sessionKeyEncrypted = encryptSecret(mnemonic.trim());
    await user.save();
    
    return res.json({ success: true });
  } catch (e) {
    console.error("[POST /burner] error:", e.message);
    res.status(500).json({ error: "Failed to sync burner wallet" });
  }
});

/**
 * GET /api/profile/session-key
 * Fetch the user's synced encrypted EVM session key.
 */
router.get("/session-key", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.json({ encryptedKey: null });
    return res.json({ encryptedKey: user.sessionKeyEncrypted || null });
  } catch {
    return res.status(500).json({ error: "Failed to fetch session key" });
  }
});

/**
 * POST /api/profile/session-key
 * Sync a locally encrypted EVM session key to the user profile.
 */
router.post("/session-key", requireAuth, async (req, res) => {
  try {
    const { encryptedKey } = req.body;
    if (!encryptedKey || typeof encryptedKey !== "string") {
      return res.status(400).json({ error: "encryptedKey is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.json({ success: true, skipped: true });

    user.sessionKeyEncrypted = encryptedKey.trim();
    await user.save();
    return res.json({ success: true });
  } catch (e) {
    console.error("[session-key] sync error:", e.message);
    return res.status(500).json({ error: "Failed to sync session key" });
  }
});

/**
 * POST /api/profile/session-key/address
 * Derive the EVM address for a session private key.
 */
router.post("/session-key/address", requireAuth, async (req, res) => {
  try {
    const privateKey = normalizePrivateKey(req.body?.privateKey);
    const wallet = new ethers.Wallet(privateKey);
    return res.json({ address: wallet.address });
  } catch {
    return res.status(400).json({ error: "Invalid private key" });
  }
});

/**
 * POST /api/profile/session-key/send
 * Send ETH from the local session key wallet for x402 payments.
 */
router.post("/session-key/send", requireAuth, async (req, res) => {
  try {
    const privateKey = normalizePrivateKey(req.body?.privateKey);
    const to = String(req.body?.to || "").trim();
    const amountWei = BigInt(String(req.body?.amountWei || "0"));

    if (!ethers.isAddress(to)) return res.status(400).json({ error: "Invalid recipient" });
    if (amountWei <= 0n) return res.status(400).json({ error: "Invalid amountWei" });

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com");
    const wallet = new ethers.Wallet(privateKey, provider);
    const tx = await wallet.sendTransaction({ to, value: amountWei });
    const receipt = await tx.wait();

    return res.json({ txHash: receipt.hash, from: wallet.address, to, amountWei: amountWei.toString() });
  } catch (e) {
    console.error("[session-key/send] error:", e.message);
    return res.status(500).json({ error: "Failed to send session key payment", detail: e.message });
  }
});

export default router;
