import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");
    const payload = jwt.verify(token, secret);
    if (!payload.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    
    // Dynamically look up the user from the database to obtain their latest role and walletAddress.
    // This makes authentication highly resilient to stale client-side JWT token payloads
    // (e.g. if the user's role was upgraded to creator in the database, but their active token has not expired).
    const userDoc = await User.findById(payload.sub).select("role walletAddress").lean();

    req.user = {
      walletAddress: userDoc?.walletAddress || payload.walletAddress || null,
      role: userDoc?.role || payload.role,
      userId: payload.sub,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
