import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AccessToken } from "../models/AccessToken.js";
import { Service } from "../models/Service.js";
import { UserBalance } from "../models/UserBalance.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { algoToMicroAlgos } from "../services/algorandService.js";
import { forwardChatCompletion } from "../services/aiProxy.js";
import { decryptSecret } from "../utils/encrypt.js";

const router = Router();

const invokeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
      "";
    const k = typeof raw === "string" ? raw.trim() : "";
    return k ? `k:${k.slice(0, 128)}` : `ip:${req.ip}`;
  },
});

async function runProxyInvoke(req, res) {
  const key =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!key || typeof key !== "string") {
    return res.status(401).json({ error: "Missing API key" });
  }

  const token = await AccessToken.findOne({ key: key.trim() });
  if (!token) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  const service = await Service.findById(token.serviceId);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (service.isPaused) {
    return res.status(503).json({ error: "Service is paused" });
  }
  if (!service.encryptedApiKey || !service.aiProvider) {
    return res.status(503).json({
      error: "Service is not configured with a live AI provider",
    });
  }

  const priceMicro = algoToMicroAlgos(Number(service.price));
  if (!Number.isFinite(priceMicro) || priceMicro < 0) {
    return res.status(500).json({ error: "Invalid service pricing" });
  }

  const debit = await UserBalance.findOneAndUpdate(
    {
      userWallet: token.userWallet,
      balanceMicroAlgos: { $gte: priceMicro },
    },
    { $inc: { balanceMicroAlgos: -priceMicro } },
    { new: true }
  );

  if (!debit) {
    return res.status(402).json({
      error: "Insufficient balance",
      detail: "Top up your Sentinel balance to use this proxy key.",
    });
  }

  service.totalUses = (service.totalUses || 0) + 1;
  service.totalRevenue = Number(service.totalRevenue || 0) + Number(service.price);
  await service.save();

  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    await UserBalance.findOneAndUpdate(
      { userWallet: token.userWallet },
      { $inc: { balanceMicroAlgos: priceMicro } }
    );
    service.totalUses = Math.max(0, (service.totalUses || 1) - 1);
    service.totalRevenue = Math.max(
      0,
      Number(service.totalRevenue) - Number(service.price)
    );
    await service.save();
    console.error("decryptSecret", e);
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const aiResponse = await forwardChatCompletion({
      provider: service.aiProvider,
      apiKey: providerKey,
      model: service.modelName,
      body,
    });
    providerKey = null;

    await ApiUsageLog.create({
      userWallet: token.userWallet,
      serviceId: service._id,
      accessTokenId: token._id,
      amountAlgo: Number(service.price),
      aiProvider: service.aiProvider,
      modelName: service.modelName,
    });

    if (!token.isUsed) {
      token.isUsed = true;
      await token.save();
    }

    res.json(aiResponse);
  } catch (err) {
    await UserBalance.findOneAndUpdate(
      { userWallet: token.userWallet },
      { $inc: { balanceMicroAlgos: priceMicro } }
    );
    service.totalUses = Math.max(0, (service.totalUses || 1) - 1);
    service.totalRevenue = Math.max(
      0,
      Number(service.totalRevenue) - Number(service.price)
    );
    await service.save();

    const status = err.status && Number.isFinite(err.status) ? err.status : 502;
    console.error("[proxy invoke]", err?.message || err);
    res.status(status).json({
      error: "Upstream AI error",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

router.post("/invoke", invokeRateLimit, runProxyInvoke);
router.post("/v1/chat/completions", invokeRateLimit, runProxyInvoke);

export default router;
