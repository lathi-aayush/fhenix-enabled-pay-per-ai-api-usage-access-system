import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import algosdk from "algosdk";
import { User } from "../models/User.js";
import { LoginChallenge } from "../models/LoginChallenge.js";
import { requireAuth } from "../middleware/auth.js";
import {
  canonicalWalletAddress,
  migrateWalletAliasesToCanonical,
} from "../utils/userWallet.js";

const router = Router();

function signUserToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Server misconfigured");
  return jwt.sign(
    {
      sub: user._id.toString(),
      walletAddress: user.walletAddress || null,
      role: user.role,
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
    },
    secret,
    { expiresIn: "7d" }
  );
}

function userPayload(user) {
  return {
    id: user._id,
    walletAddress: user.walletAddress,
    role: user.role,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
  };
}

/**
 * Cryptographically verifies a challenge signature using algosdk.verifyBytes
 */
async function verifyChallenge(walletAddress, nonce, signature) {
  if (!walletAddress || !nonce || !signature) {
    throw new Error("Missing wallet address, nonce, or signature");
  }

  const challenge = await LoginChallenge.findOne({
    walletAddress,
    nonce,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!challenge) {
    throw new Error("Invalid or expired login challenge");
  }

  let ok = false;
  try {
    const messageBytes = new TextEncoder().encode(challenge.message);
    const signatureBytes = Buffer.from(signature, "base64");
    ok = algosdk.verifyBytes(messageBytes, signatureBytes, walletAddress);
  } catch (err) {
    console.error("[auth] Signature verification error:", err.message);
    throw new Error("Invalid signature format or error during verification");
  }

  if (!ok) {
    throw new Error("Invalid wallet signature");
  }

  challenge.used = true;
  await challenge.save();
  return true;
}

/**
 * GET /api/auth/check-name
 * Checks if a display name is unique/available
 */
router.get("/check-name", async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name || name.length < 3) {
    return res.json({ available: false, reason: "Name must be at least 3 characters" });
  }
  try {
    const user = await User.findOne({
      displayName: { $regex: new RegExp(`^${name}$`, "i") },
    });
    return res.json({ available: !user });
  } catch (e) {
    return res.status(500).json({ error: "Database error" });
  }
});

/**
 * POST /api/auth/challenge
 * Generates a challenge for the wallet to sign
 */
router.post(
  "/challenge",
  body("walletAddress").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { walletAddress } = req.body;
    let canonical;
    try {
      canonical = canonicalWalletAddress(walletAddress);
    } catch (e) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    const timestamp = new Date().toISOString();
    const domain = req.get("host") || "localhost";
    const message = `Sign in to SentinelAI\nWallet: ${canonical}\nNonce: ${nonce}\nTimestamp: ${timestamp}\nDomain: ${domain}`;

    try {
      await LoginChallenge.create({
        walletAddress: canonical,
        nonce,
        message,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      res.json({ nonce, message });
    } catch (err) {
      console.error("[challenge] error:", err.message);
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  }
);

/**
 * POST /api/auth/login
 * Pera Wallet login — verified via challenge signature
 */
router.post(
  "/login",
  body("walletAddress").isString().trim().notEmpty(),
  body("nonce").isString().trim().notEmpty(),
  body("signature").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { role, nonce, signature } = req.body;
    const rawWallet = String(req.body.walletAddress || "").trim();

    let canonical;
    try {
      canonical = canonicalWalletAddress(rawWallet);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid wallet address" });
    }

    // Verify challenge signature
    try {
      await verifyChallenge(canonical, nonce, signature);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    await migrateWalletAliasesToCanonical(canonical, rawWallet);

    let user = await User.findOne({
      $or: [{ walletAddress: canonical }, { walletAddress: rawWallet }],
    });

    let isNewUser = false;
    if (!user) {
      user = await User.create({ walletAddress: canonical, role });
      isNewUser = true;
    } else {
      const updates = {};
      if (user.walletAddress !== canonical) updates.walletAddress = canonical;
      // A creator should never be demoted to a user on login.
      // But a standard user can be upgraded to a creator.
      if (user.role === "user" && role === "creator") {
        updates.role = "creator";
      }
      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
      }
    }

    const needsProfile = !user.displayName;
    const token = signUserToken(user);

    res.json({
      token,
      isNewUser: isNewUser || needsProfile,
      needsProfile,
      user: userPayload(user),
    });
  }
);

/**
 * POST /api/auth/register
 * Completes profile setup (display name) after verified challenge login
 */
router.post(
  "/register",
  body("walletAddress").isString().trim().notEmpty(),
  body("nonce").isString().trim().notEmpty(),
  body("signature").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  body("displayName").isString().trim().isLength({ min: 3, max: 30 }).notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, displayName, nonce, signature } = req.body;
    const cleanName = String(displayName).trim();
    const rawWallet = String(req.body.walletAddress || "").trim();

    try {
      const nameExists = await User.findOne({
        displayName: { $regex: new RegExp(`^${cleanName}$`, "i") },
      });
      if (nameExists) {
        return res.status(400).json({ error: "This display name is already taken. Please choose another unique name." });
      }

      let canonical;
      try {
        canonical = canonicalWalletAddress(rawWallet);
      } catch (e) {
        return res.status(400).json({ error: "Invalid Algorand wallet address" });
      }

      // Verify challenge signature
      try {
        await verifyChallenge(canonical, nonce, signature);
      } catch (err) {
        return res.status(401).json({ error: err.message });
      }

      let user = await User.findOne({
        $or: [{ walletAddress: canonical }, { walletAddress: rawWallet }],
      });

      if (!user) {
        user = await User.create({
          walletAddress: canonical,
          role,
          displayName: cleanName,
        });
      } else {
        if (user.displayName) {
          return res.status(400).json({ error: "Profile already set up for this wallet." });
        }
        user = await User.findByIdAndUpdate(
          user._id,
          { $set: { displayName: cleanName, role, walletAddress: canonical } },
          { new: true }
        );
      }

      const token = signUserToken(user);
      res.json({
        isNewUser: false,
        token,
        user: userPayload(user),
      });
    } catch (e) {
      console.error("[register] error:", e.message);
      res.status(500).json({ error: e.message || "Registration failed. Display name may already be taken." });
    }
  }
);

/**
 * POST /api/auth/link-wallet
 * Links an Algorand wallet address to the logged-in profile after verified challenge
 */
router.post(
  "/link-wallet",
  requireAuth,
  body("walletAddress").isString().trim().notEmpty(),
  body("nonce").isString().trim().notEmpty(),
  body("signature").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nonce, signature } = req.body;
    const rawWallet = String(req.body.walletAddress || "").trim();
    let canonical;
    try {
      canonical = canonicalWalletAddress(rawWallet);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid wallet address" });
    }

    // Verify challenge signature
    try {
      await verifyChallenge(canonical, nonce, signature);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    await User.updateMany(
      { walletAddress: canonical, _id: { $ne: req.user.userId } },
      { $unset: { walletAddress: "" } }
    );

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { walletAddress: canonical } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const token = signUserToken(user);
    res.json({ token, user: userPayload(user) });
  }
);

/**
 * POST /api/auth/become-creator
 * Switch the logged-in account to creator role (requires linked Pera wallet).
 */
router.post("/become-creator", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    if (!user.walletAddress?.trim()) {
      return res.status(400).json({
        error: "Link your Pera wallet first (Profile or home → Connect as Creator).",
        code: "WALLET_REQUIRED",
      });
    }

    if (user.role === "creator") {
      return res.json({ token: signUserToken(user), user: userPayload(user) });
    }

    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: { role: "creator" } },
      { new: true }
    );
    const token = signUserToken(updated);
    res.json({ token, user: userPayload(updated) });
  } catch (e) {
    console.error("[become-creator]", e);
    res.status(500).json({ error: "Could not switch to creator mode" });
  }
});

export default router;
