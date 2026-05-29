import { api } from "./client.js";

export function friendlyThumbnailError(err) {
  const msg = err?.response?.data?.error || err?.message || String(err);
  if (msg.includes("quota exceeded")) {
    return "Monthly Studio AI limit reached. Upgrade your plan to continue.";
  }
  return msg.slice(0, 220) || "Generation failed. Please retry.";
}

export async function generateThumbnailStrategy(payload) {
  const { data } = await api.post("/api/studio/thumbnail/generate", payload);
  return data.result;
}

export async function regenerateThumbnailVariations(payload, previousResult, options = {}) {
  const { data } = await api.post("/api/studio/thumbnail/variations", {
    payload,
    previousResult,
    generateImages: options.generateImages !== false,
  });
  return data.result;
}

export async function regenerateThumbnailMainImage(payload, previousResult) {
  const { data } = await api.post("/api/studio/thumbnail/regenerate-image", {
    payload,
    previousResult,
  });
  return data.result;
}
