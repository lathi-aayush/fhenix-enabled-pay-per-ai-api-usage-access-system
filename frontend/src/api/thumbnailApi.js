import { studioFetch } from "./studioFetch.js";

export function friendlyThumbnailError(err) {
  const msg = err?.response?.data?.error || err?.message || String(err);
  if (msg.includes("quota exceeded") || msg.includes("402")) {
    return "Payment required. Approve the transaction in your MetaMask.";
  }
  return msg.slice(0, 220) || "Generation failed. Please retry.";
}

export async function generateThumbnailStrategy(payload) {
  const res = await studioFetch("/api/studio/thumbnail/generate", {
    method: "POST",
    body: payload,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.result;
}

export async function regenerateThumbnailVariations(payload, previousResult, options = {}) {
  const res = await studioFetch("/api/studio/thumbnail/variations", {
    method: "POST",
    body: {
      payload,
      previousResult,
      generateImages: options.generateImages !== false,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.result;
}

export async function regenerateThumbnailMainImage(payload, previousResult) {
  const res = await studioFetch("/api/studio/thumbnail/regenerate-image", {
    method: "POST",
    body: {
      payload,
      previousResult,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.result;
}
