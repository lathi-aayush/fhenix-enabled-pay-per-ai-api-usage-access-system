import { Router } from "express";
import { User } from "../models/User.js";
import { Service } from "../models/Service.js";
import { AccessToken } from "../models/AccessToken.js";

const router = Router();

/**
 * Middleware to protect dev dashboard routes via a shared secret header.
 */
function requireDevSecret(req, res, next) {
  const secret = req.headers["x-dev-secret"];
  const expected = process.env.DEV_ADMIN_SECRET;

  if (!expected) {
    return res.status(500).json({ error: "DEV_ADMIN_SECRET is not configured on the backend." });
  }

  if (secret !== expected) {
    return res.status(403).json({ error: "Invalid developer secret key." });
  }

  next();
}

/**
 * GET /api/dev/users
 * Returns a list of all registered users.
 */
router.get("/users", requireDevSecret, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * DELETE /api/dev/users/:id
 * Force deletes a user profile from MongoDB.
 */
router.delete("/users/:id", requireDevSecret, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found in MongoDB" });
    }

    if (user.walletAddress) {
      await AccessToken.deleteMany({ userWallet: user.walletAddress });
    }

    if (user.walletAddress && user.role === "creator") {
      await Service.updateMany(
        { creatorWallet: user.walletAddress },
        { $set: { isPaused: true } }
      );
    }

    await User.findByIdAndDelete(user._id);

    console.log(`[Dev] Deleted MongoDB user profile: ${user._id}`);
    res.json({ success: true, message: "User completely removed from system." });
  } catch (error) {
    console.error("[Dev] User deletion error:", error);
    res.status(500).json({ error: "Failed to completely delete user" });
  }
});

export default router;
