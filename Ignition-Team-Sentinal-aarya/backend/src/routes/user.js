import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserBalance } from "../models/UserBalance.js";
import { AccessToken } from "../models/AccessToken.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";

const router = Router();

router.get("/balance", requireAuth, requireRole("user"), async (req, res) => {
  const doc = await UserBalance.findOne({ userWallet: req.user.walletAddress }).lean();
  const micro = doc?.balanceMicroAlgos ?? 0;
  res.json({
    balanceMicroAlgos: micro,
    balanceAlgo: micro / 1e6,
  });
});

router.get("/proxy-keys", requireAuth, requireRole("user"), async (req, res) => {
  const tokens = await AccessToken.find({ userWallet: req.user.walletAddress })
    .sort({ createdAt: -1 })
    .populate("serviceId", "title price aiProvider modelName totalUses")
    .lean();
  const out = tokens.map((t) => ({
    id: t._id,
    keySuffix: t.key.slice(-8),
    key: t.key,
    createdAt: t.createdAt,
    service: t.serviceId
      ? {
          id: t.serviceId._id,
          title: t.serviceId.title,
          price: t.serviceId.price,
          aiProvider: t.serviceId.aiProvider,
          modelName: t.serviceId.modelName,
          totalUses: t.serviceId.totalUses,
        }
      : null,
  }));
  res.json(out);
});

router.get("/usage", requireAuth, requireRole("user"), async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const logs = await ApiUsageLog.find({ userWallet: req.user.walletAddress })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("serviceId", "title")
    .lean();
  res.json(
    logs.map((l) => ({
      id: l._id,
      createdAt: l.createdAt,
      amountAlgo: l.amountAlgo,
      aiProvider: l.aiProvider,
      modelName: l.modelName,
      serviceTitle: l.serviceId?.title ?? null,
      serviceId: l.serviceId?._id ?? l.serviceId,
    }))
  );
});

export default router;
