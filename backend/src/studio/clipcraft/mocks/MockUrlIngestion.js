// @filename: backend/src/studio/clipcraft/mocks/MockUrlIngestion.js

import { asUrlIngestion } from "../interfaces/IUrlIngestion.js";

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const TW_RE = /twitch\.tv\/videos\/(\d+)/i;

function detectPlatform(url) {
  if (YT_RE.test(url)) return "youtube";
  if (TW_RE.test(url)) return "twitch";
  return "unknown";
}

function extractId(url, platform) {
  if (platform === "youtube") return url.match(YT_RE)?.[1] ?? "mock-yt";
  if (platform === "twitch") return url.match(TW_RE)?.[1] ?? "mock-tw";
  return "mock-unknown";
}

export function createMockUrlIngestion() {
  return asUrlIngestion({
    async normalizeUrl(url) {
      const trimmed = String(url || "").trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error("URL must start with http:// or https://");
      }
      const platform = detectPlatform(trimmed);
      const videoId = extractId(trimmed, platform);
      return {
        canonicalUrl: trimmed.split("&")[0],
        platform,
        videoId,
        title: `Mock Video ${videoId}`,
        durationSec: 612,
        channelId: `ch-${videoId}`,
        raw: { mock: true },
      };
    },
    async extractMetadata(url) {
      return this.normalizeUrl(url);
    },
  });
}
