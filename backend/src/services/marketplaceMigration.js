import crypto from "crypto";
import { Service } from "../models/Service.js";
import { ProxyApi } from "../models/ProxyApi.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { UsageRecord } from "../models/UsageRecord.js";
import { User } from "../models/User.js";
import { AccessToken } from "../models/AccessToken.js";
import { GatewaySubscription } from "../models/GatewaySubscription.js";
import { PROVIDER_ROOT, providerCategory } from "../constants/aiProviders.js";

function slugify(title, id) {
  const base = String(title || "api")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "api"}-${String(id).slice(-6)}`;
}

function ethMinimumToCents(minimumChargeEth) {
  const rate = Number(process.env.ETH_USD_RATE || 35);
  const eth = Number(minimumChargeEth) || 0;
  return Math.max(1, Math.round(eth * rate));
}

export function serviceToProxyApiPayload(service, developerId) {
  const root =
    service.aiProvider === "custom"
      ? String(service.customEndpointUrl || "").replace(/\/+$/, "")
      : PROVIDER_ROOT[service.aiProvider] || "https://api.openai.com/v1";

  return {
    developerId,
    developerWallet: service.creatorWallet,
    legacyServiceId: service._id,
    name: service.title,
    description: service.description || "",
    baseUrl: root,
    proxySlug: slugify(service.title, service._id),
    pricingModel:
      Number(service.pricePerThousandTokens) > 0 ? "per_1000_tokens" : "per_request",
    pricePerUnit:
      Number(service.pricePerThousandTokens) > 0
        ? Math.max(1, Math.round(Number(service.pricePerThousandTokens) * Number(process.env.ETH_USD_RATE || 35)))
        : ethMinimumToCents(service.minimumChargeEth),
    authType: "bearer",
    authHeaderEncrypted: service.encryptedApiKey,
    streamingSupported: true,
    timeoutMs: 30000,
    isActive: !service.isPaused,
    aiProvider: service.aiProvider,
    modelName: service.modelName || "",
    customEndpointUrl: service.customEndpointUrl || "",
    category: providerCategory(service.aiProvider),
    tags: [service.aiProvider, service.modelName].filter(Boolean),
  };
}

export async function findDeveloperUserForWallet(wallet) {
  return User.findOne({ walletAddress: wallet }).lean();
}

export async function syncServiceToProxyApi(serviceId) {
  const service = await Service.findById(serviceId).lean();
  if (!service) {
    return { ok: false, error: "Service not found" };
  }

  const developer = await findDeveloperUserForWallet(service.creatorWallet);
  const developerId = developer?._id ?? null;

  const existing = await ProxyApi.findOne({ legacyServiceId: service._id });
  const payload = serviceToProxyApiPayload(service, developerId);

  if (existing) {
    await ProxyApi.updateOne({ _id: existing._id }, { $set: payload });
    return { ok: true, action: "updated", proxyApiId: existing._id, proxySlug: existing.proxySlug };
  }

  let slug = payload.proxySlug;
  for (let i = 0; i < 5; i++) {
    const clash = await ProxyApi.findOne({ proxySlug: slug });
    if (!clash) break;
    slug = `${payload.proxySlug}-${i + 1}`;
  }
  payload.proxySlug = slug;

  const created = await ProxyApi.create(payload);
  return { ok: true, action: "created", proxyApiId: created._id, proxySlug: created.proxySlug };
}

export async function syncAllServicesToProxyApis({ onlyActive = false } = {}) {
  const filter = onlyActive ? { isPaused: false } : {};
  const services = await Service.find(filter).lean();
  const results = [];

  for (const service of services) {
    try {
      const row = await syncServiceToProxyApi(service._id);
      results.push({ serviceId: service._id, title: service.title, ...row });
    } catch (err) {
      results.push({
        serviceId: service._id,
        title: service.title,
        ok: false,
        error: err?.message || String(err),
      });
    }
  }

  return {
    total: services.length,
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export async function migrateAccessTokensToSubscriptions({ limit = 500 } = {}) {
  const tokens = await AccessToken.find().limit(limit).lean();
  let created = 0;
  let skipped = 0;

  for (const token of tokens) {
    const proxy = await ProxyApi.findOne({ legacyServiceId: token.serviceId }).lean();
    if (!proxy) {
      skipped++;
      continue;
    }
    const consumer = await User.findOne({ walletAddress: token.userWallet }).lean();
    if (!consumer) {
      skipped++;
      continue;
    }

    const exists = await GatewaySubscription.findOne({
      consumerId: consumer._id,
      apiId: proxy._id,
    });
    if (exists) {
      skipped++;
      continue;
    }

    await GatewaySubscription.create({
      consumerId: consumer._id,
      apiId: proxy._id,
      legacyAccessTokenId: token._id,
      developerIssuedKey: token.key,
      isActive: true,
    });
    created++;
  }

  return { processed: tokens.length, created, skipped };
}

function mapUsageLogToRecord(log, proxy, consumer, developer) {
  const success = log.success !== false;
  const costCents = ethMinimumToCents(log.chargeEth ?? log.amountEth);
  return {
    requestId: log.paymentRef || log.paymentTxId || `legacy-${log._id}`,
    consumerId: consumer?._id,
    developerId: developer?._id ?? proxy.developerId,
    apiId: proxy._id,
    legacyUsageLogId: log._id,
    timestamp: log.createdAt || new Date(),
    method: "POST",
    endpoint: "/api/use",
    requestStatus: success ? "success" : "failed",
    httpStatus: success ? 200 : 502,
    responseTimeMs: null,
    tokensPrompt: log.promptTokens,
    tokensCompletion: log.completionTokens,
    tokensTotal: log.totalTokens,
    costUnits: 1,
    costCents: success ? costCents : 0,
    billingStatus: success ? "charged" : "failed",
    errorMessage: log.errorDetail,
  };
}

export async function migrateApiUsageLogs({ limit = 200, dryRun = false } = {}) {
  const logs = await ApiUsageLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  let migrated = 0;
  let skipped = 0;

  for (const log of logs) {
    const existing = await UsageRecord.findOne({
      $or: [{ legacyUsageLogId: log._id }, { requestId: log.paymentRef || log.paymentTxId }],
    }).lean();
    if (existing) {
      skipped++;
      continue;
    }

    const proxy = await ProxyApi.findOne({ legacyServiceId: log.serviceId }).lean();
    if (!proxy) {
      skipped++;
      continue;
    }

    const consumer = await User.findOne({ walletAddress: log.userWallet }).lean();
    const developer = proxy.developerId
      ? await User.findById(proxy.developerId).lean()
      : await findDeveloperUserForWallet(log.developerWallet);

    const record = mapUsageLogToRecord(log, proxy, consumer, developer);
    if (!dryRun) {
      await UsageRecord.create(record);
    }
    migrated++;
  }

  return { processed: logs.length, migrated, skipped, dryRun };
}

export async function ensureSentinelApiKey(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.sentinelApiKey) {
    return { key: user.sentinelApiKey, created: false };
  }
  const key = `sk-sentinel-${crypto.randomBytes(32).toString("hex")}`;
  user.sentinelApiKey = key;
  await user.save();
  return { key, created: true };
}

export async function getMigrationStatus() {
  const [services, proxyApis, usageLogs, usageRecords, subscriptions] = await Promise.all([
    Service.countDocuments(),
    ProxyApi.countDocuments(),
    ApiUsageLog.countDocuments(),
    UsageRecord.countDocuments(),
    GatewaySubscription.countDocuments(),
  ]);

  const migratedIds = (await ProxyApi.distinct("legacyServiceId")).filter(Boolean);
  const unmigratedServices = await Service.countDocuments({
    _id: { $nin: migratedIds },
  });

  return {
    services,
    proxyApis,
    unmigratedServices,
    usageLogs,
    usageRecords,
    subscriptions,
    proxyEndpoint: "POST /proxy/:slug/*",
  };
}
