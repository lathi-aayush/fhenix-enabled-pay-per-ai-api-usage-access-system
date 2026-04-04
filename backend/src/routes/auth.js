import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import {
  canonicalWalletAddress,
  migrateWalletAliasesToCanonical,
} from "../utils/userWallet.js";

const router = Router();

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

    if (!user) {
      user = await User.create({ walletAddress: canonical, role });
    } else {
      const updates = {};
      if (user.walletAddress !== canonical) {
        updates.walletAddress = canonical;
      }
      if (user.role !== role) {
        updates.role = role;
      }
      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
      }
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        walletAddress: user.walletAddress,
        role: user.role,
      },
      secret,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    });
  }
);

export default router;
