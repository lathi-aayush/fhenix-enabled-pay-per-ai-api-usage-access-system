import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
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
 * POST /api/auth/login
 * Pera Wallet login — wallet address is the identity
 */
router.post(
  "/login",
  body("walletAddress").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { role } = req.body;
    const rawWallet = String(req.body.walletAddress || "").trim();

    let canonical;
    try {
      canonical = canonicalWalletAddress(rawWallet);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid wallet address" });
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
      if (user.role !== role) updates.role = role;
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
 * Completes profile setup (display name) after Pera wallet login
 */
router.post(
  "/register",
  body("walletAddress").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  body("displayName").isString().trim().isLength({ min: 3, max: 30 }).notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, displayName } = req.body;
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
      res.status(500).json({ error: "Registration failed. Display name may already be taken." });
    }
  }
);

/**
 * POST /api/auth/link-wallet
 * Links an Algorand wallet address to the logged-in profile
 */
router.post(
  "/link-wallet",
  requireAuth,
  body("walletAddress").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawWallet = String(req.body.walletAddress || "").trim();
    let canonical;
    try {
      canonical = canonicalWalletAddress(rawWallet);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Invalid wallet address" });
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

export default router;
