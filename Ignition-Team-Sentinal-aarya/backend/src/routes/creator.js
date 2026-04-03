import { Router } from "express";
import { query, validationResult } from "express-validator";
import { Service } from "../models/Service.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get(
  "/services",
  requireAuth,
  requireRole("creator"),
  async (req, res) => {
    const list = await Service.find({ creatorWallet: req.user.walletAddress })
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      list.map(({ encryptedApiKey: _e, ...rest }) => ({
        ...rest,
        providerConfigured: Boolean(rest.aiProvider && _e),
      }))
    );
  }
);

router.get("/stats", requireAuth, requireRole("creator"), async (req, res) => {
  const services = await Service.find({
    creatorWallet: req.user.walletAddress,
  }).lean();
  const totalRevenue = services.reduce((s, x) => s + (x.totalRevenue || 0), 0);
  const totalUses = services.reduce((s, x) => s + (x.totalUses || 0), 0);
  const serviceCount = services.length;
  const safe = services.map(({ encryptedApiKey: _e, ...rest }) => ({
    ...rest,
    providerConfigured: Boolean(rest.aiProvider && _e),
  }));
  res.json({ totalRevenue, totalUses, serviceCount, services: safe });
});

router.get(
  "/usage",
  requireAuth,
  requireRole("creator"),
  query("limit").optional().isInt({ min: 1, max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const mine = await Service.find({
      creatorWallet: req.user.walletAddress,
    })
      .select("_id")
      .lean();
    const ids = mine.map((s) => s._id);
    if (ids.length === 0) {
      return res.json([]);
    }
    const logs = await ApiUsageLog.find({ serviceId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("serviceId", "title price")
      .lean();
    res.json(
      logs.map((l) => ({
        id: l._id,
        createdAt: l.createdAt,
        userWallet: l.userWallet,
        amountAlgo: l.amountAlgo,
        aiProvider: l.aiProvider,
        modelName: l.modelName,
        serviceTitle: l.serviceId?.title,
        serviceId: l.serviceId?._id,
      }))
    );
  }
);

export default router;
