import { Router } from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import {
  canonicalWalletAddress,
  migrateWalletAliasesToCanonical,
} from "../utils/userWallet.js";

const router = Router();

// Initialize Firebase Admin SDK lazily
let firebaseAdminInitialized = false;
function verifyFirebaseToken(idToken) {
  if (!firebaseAdminInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (projectId) {
      try {
        admin.initializeApp({ projectId });
        firebaseAdminInitialized = true;
        console.log(`[Firebase Admin] Initialized with project ID: ${projectId}`);
      } catch (e) {
        console.error("[Firebase Admin] Initialization failed:", e.message);
      }
    } else {
      console.warn("[Firebase Admin] FIREBASE_PROJECT_ID is not set in env. Using Mock Verification.");
    }
  }

  // Developer mock verification fallback
  if (!firebaseAdminInitialized || idToken.startsWith("mock-")) {
    console.log("[Firebase Admin] Performing mock token decoding for ID token:", idToken);
    
    let email = "dev-user@example.com";
    let name = "Developer User";
    let uid = "mock-uid-dev-user@example.com";
    const picture = "https://lh3.googleusercontent.com/a/default-user";

    if (idToken.includes("|")) {
      const parts = idToken.split("|");
      email = parts[1] || email;
      name = parts[2] ? parts[2].replace(/_/g, " ") : name;
      uid = parts[3] || uid;
    } else {
      const parts = idToken.split("-");
      const emailIdx = parts.findIndex(p => p.includes("@"));
      if (emailIdx !== -1) {
        email = parts[emailIdx];
        name = parts[emailIdx + 1] ? parts[emailIdx + 1].replace(/_/g, " ") : name;
        uid = parts[emailIdx + 2] || uid;
      }
    }

    return { uid, email, name, picture };
  }

  return admin.auth().verifyIdToken(idToken);
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
 * POST /api/auth/firebase-login
 * Signs in user via Google (Firebase ID Token)
 */
router.post(
  "/firebase-login",
  body("idToken").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { idToken, role } = req.body;

    try {
      const decoded = await verifyFirebaseToken(idToken);
      const { uid, email, name, picture } = decoded;

      let user = await User.findOne({ firebaseUid: uid });

      if (!user) {
        // DO NOT create user profile yet! Return isNewUser flag
        return res.json({
          isNewUser: true,
          firebaseUid: uid,
          email,
          displayName: name || "",
          photoURL: picture || "",
        });
      } else {
        // Update user profile metadata if changed
        const updates = {};
        if (!user.displayName && name) updates.displayName = name;
        if (user.photoURL !== picture) updates.photoURL = picture;
        if (user.role !== role) updates.role = role;

        if (Object.keys(updates).length > 0) {
          user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
        }
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ error: "Server misconfigured" });

      const token = jwt.sign(
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

      res.json({
        isNewUser: false,
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
      console.error("[firebase-login] verification error:", e.message);
      res.status(401).json({ error: "Invalid Google authorization token" });
    }
  }
);

/**
 * POST /api/auth/register
 * Finalizes account registration with a unique display name and Pera wallet address scan
 */
router.post(
  "/register",
  body("idToken").isString().trim().notEmpty(),
  body("role").isIn(["user", "creator"]),
  body("displayName").isString().trim().isLength({ min: 3, max: 30 }).notEmpty(),
  body("walletAddress").isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { idToken, role, displayName, walletAddress } = req.body;
    const cleanName = String(displayName).trim();
    const rawWallet = String(walletAddress).trim();

    try {
      // 1. Verify Google identity
      const decoded = await verifyFirebaseToken(idToken);
      const { uid, email, picture } = decoded;

      // 2. Enforce unique display name check
      const nameExists = await User.findOne({
        displayName: { $regex: new RegExp(`^${cleanName}$`, "i") },
      });
      if (nameExists) {
        return res.status(400).json({ error: "This display name is already taken. Please choose another unique name." });
      }

      // 3. Enforce canonical wallet address validation
      let canonical;
      try {
        canonical = canonicalWalletAddress(rawWallet);
      } catch (e) {
        return res.status(400).json({ error: "Invalid Algorand wallet address" });
      }

      // 4. Double check if Google UID already has an account to prevent duplicates
      let existingUser = await User.findOne({ firebaseUid: uid });
      if (existingUser) {
        return res.status(400).json({ error: "An account already exists for this Google user." });
      }

      // 5. Unlink wallet from any legacy profiles to avoid duplicate keys
      await User.updateMany(
        { walletAddress: canonical },
        { $unset: { walletAddress: "" } }
      );

      // 6. Create the user in MongoDB
      const user = await User.create({
        firebaseUid: uid,
        email,
        displayName: cleanName,
        photoURL: picture,
        role,
        walletAddress: canonical,
      });

      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ error: "Server misconfigured" });

      const token = jwt.sign(
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

      res.json({
        isNewUser: false,
        token,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
        },
      });
    } catch (e) {
      console.error("[register] error:", e.message);
      res.status(500).json({ error: "Registration failed. Display name may already be taken." });
    }
  }
);

/**
 * POST /api/auth/link-wallet
 * Links an Algorand wallet address to the logged-in Google profile
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

    // Unlink this wallet address from any other user profiles to prevent duplicate key constraint issues
    await User.updateMany(
      { walletAddress: canonical, _id: { $ne: req.user.userId } },
      { $unset: { walletAddress: "" } }
    );

    // Save wallet address to current user (the Firebase / Google profile)
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { walletAddress: canonical } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });

    // Generate updated Sentinel JWT incorporating wallet address
    const token = jwt.sign(
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

    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role,
      },
    });
  }
);

/**
 * Legacy Pera Wallet login fallback (deprecated but preserved for backward compatibility)
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

    if (!user) {
      user = await User.create({ walletAddress: canonical, role });
    } else {
      const updates = {};
      if (user.walletAddress !== canonical) updates.walletAddress = canonical;
      if (user.role !== role) updates.role = role;
      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });
      }
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });
    const token = jwt.sign(
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
