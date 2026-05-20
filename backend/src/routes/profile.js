import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Service } from "../models/Service.js";
import { AccessToken } from "../models/AccessToken.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { requireAuth } from "../middleware/auth.js";
import { encryptSecret, decryptSecret } from "../utils/encrypt.js";

const router = Router();

/**
 * GET /api/profile/summary
 * Retrieves Google profile info, linked wallet, creator APIs, and user usage history
 */
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const responseData = {
      profile: {
        id: user._id,
        email: user.email || null,
        displayName: user.displayName || "Google User",
        photoURL: user.photoURL || "https://lh3.googleusercontent.com/a/default-user",
        role: user.role,
        walletAddress: user.walletAddress || null,
        createdAt: user.createdAt,
      },
      creatorSummary: null,
      userSummary: null,
    };

    const walletAddress = user.walletAddress;

    // Fetch Creator Statistics if a wallet is connected
    if (walletAddress) {
      if (user.role === "creator") {
        const services = await Service.find({ creatorWallet: walletAddress });
        
        let totalRevenue = 0;
        let totalUses = 0;
        services.forEach((s) => {
          totalRevenue += s.totalRevenue || 0;
          totalUses += s.totalUses || 0;
        });

        // Get logs for services they created
        const recentSales = await ApiUsageLog.find({ developerWallet: walletAddress })
          .populate("serviceId", "title")
          .sort({ createdAt: -1 })
          .limit(10);

        responseData.creatorSummary = {
          servicesCount: services.length,
          totalRevenue,
          totalUses,
          services: services.map((s) => ({
            id: s._id,
            title: s.title,
            description: s.description,
            pricePerThousandTokens: s.pricePerThousandTokens,
            minimumChargeAlgo: s.minimumChargeAlgo,
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
            amountAlgo: log.amountAlgo || log.chargeAlgo || 0,
            promptTokens: log.promptTokens || 0,
            completionTokens: log.completionTokens || 0,
            success: log.success,
            createdAt: log.createdAt,
          })),
        };
      }

      // Fetch User Statistics
      // 1. Purchased keys (Access Tokens)
      const purchasedKeys = await AccessToken.find({ userWallet: walletAddress })
        .populate("serviceId", "title description pricePerThousandTokens minimumChargeAlgo aiProvider modelName");

      // 2. Recent usage logs (calls they made)
      const recentCalls = await ApiUsageLog.find({ userWallet: walletAddress })
        .populate("serviceId", "title")
        .sort({ createdAt: -1 })
        .limit(10);

      // 3. Compute aggregate spent stats
      const allLogs = await ApiUsageLog.find({ userWallet: walletAddress, success: true });
      let totalSpent = 0;
      let totalTokens = 0;
      allLogs.forEach((log) => {
        totalSpent += log.amountAlgo || log.chargeAlgo || 0;
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
            minimumChargeAlgo: token.serviceId.minimumChargeAlgo,
          } : null,
        })),
        recentCalls: recentCalls.map((log) => ({
          id: log._id,
          serviceTitle: log.serviceId?.title || "Unknown API",
          amountAlgo: log.amountAlgo || log.chargeAlgo || 0,
          totalTokens: log.totalTokens || 0,
          success: log.success,
          createdAt: log.createdAt,
          paymentTxId: log.paymentTxId,
          proofTxId: log.proofTxId,
        })),
      };
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
    
    if (!user.burnerWalletEncrypted) {
      return res.json({ mnemonic: null });
    }
    
    try {
      const mnemonic = decryptSecret(user.burnerWalletEncrypted);
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
    
    user.burnerWalletEncrypted = encryptSecret(mnemonic.trim());
    await user.save();
    
    return res.json({ success: true });
  } catch (e) {
    console.error("[POST /burner] error:", e.message);
    res.status(500).json({ error: "Failed to sync burner wallet" });
  }
});

export default router;
