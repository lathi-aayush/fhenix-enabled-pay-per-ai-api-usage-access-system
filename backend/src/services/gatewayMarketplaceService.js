import { ProxyApi } from "../models/ProxyApi.js";
import { redisGet } from "./redisClient.js";
import { todayUtc } from "./gatewayPeriodStats.js";

const CATEGORIES = [
  { id: "ai", label: "AI & LLMs" },
  { id: "custom", label: "Custom APIs" },
  { id: "data", label: "Data" },
  { id: "utility", label: "Utilities" },
];

function publicApiShape(a, extra = {}) {
  const rate = Number(process.env.ETH_USD_RATE || 35);
  return {
    id: a._id,
    name: a.name,
    description: a.description,
    proxySlug: a.proxySlug,
    proxyUrl: `/proxy/${a.proxySlug}`,
    category: a.category || "ai",
    tags: a.tags || [],
    pricingModel: a.pricingModel,
    pricePerUnitCents: a.pricePerUnit,
    pricePerUnitEth: (a.pricePerUnit || 0) / rate,
    priceUsd: ((a.pricePerUnit || 0) / 100).toFixed(4),
    priceEth: ((a.pricePerUnit || 0) / rate).toFixed(6),
    aiProvider: a.aiProvider,
    modelName: a.modelName,
    streamingSupported: a.streamingSupported,
    callCount: a.callCount || 0,
    isActive: a.isActive,
    ...extra,
  };
}

export function listCategories() {
  return CATEGORIES;
}

export async function searchMarketplaceApis({ q, category, limit = 50 } = {}) {
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (q?.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { description: rx }, { proxySlug: rx }, { tags: rx }];
  }

  const apis = await ProxyApi.find(filter)
    .select("-authHeaderEncrypted")
    .sort({ callCount: -1, createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  return apis.map((a) => publicApiShape(a));
}

export async function getTrendingApis(limit = 12) {
  const day = todayUtc();
  const apis = await ProxyApi.find({ isActive: true })
    .select("-authHeaderEncrypted")
    .sort({ callCount: -1 })
    .limit(50)
    .lean();

  const scored = await Promise.all(
    apis.map(async (a) => {
      const daily = await redisGet(`api:${a._id}:calls:daily:${day}`);
      return {
        api: a,
        dailyCalls: daily ? parseInt(daily, 10) || 0 : 0,
      };
    })
  );

  scored.sort((a, b) => b.dailyCalls - a.dailyCalls || (b.api.callCount || 0) - (a.api.callCount || 0));

  return scored.slice(0, limit).map(({ api, dailyCalls }) =>
    publicApiShape(api, { dailyCalls, badge: "trending" })
  );
}

export async function getPopularApis(limit = 12) {
  const apis = await ProxyApi.find({ isActive: true })
    .select("-authHeaderEncrypted")
    .sort({ callCount: -1 })
    .limit(limit)
    .lean();
  return apis.map((a) => publicApiShape(a, { badge: "popular" }));
}

export async function getMarketplaceHome() {
  const [categories, trending, popular, all] = await Promise.all([
    listCategories(),
    getTrendingApis(8),
    getPopularApis(8),
    searchMarketplaceApis({ limit: 24 }),
  ]);
  return { categories, trending, popular, featured: all };
}
