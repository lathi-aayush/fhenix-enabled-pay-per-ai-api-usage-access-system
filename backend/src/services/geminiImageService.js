function getApiKey() {
  const key = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!key) throw new Error("GOOGLE_API_KEY is not set on the server");
  return key;
}

const IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
];

function getImageModels() {
  const override = (process.env.GEMINI_IMAGE_MODEL || "").trim();
  if (override) return [override, ...IMAGE_MODELS.filter((m) => m !== override)];
  return IMAGE_MODELS;
}

function isModelUnavailable(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
}

export function buildThumbnailImagePrompt(payload, strategy, variation = null) {
  const hook = variation?.hook || strategy?.thumbnailText?.mainHook || payload.thumbnailText;
  return [
    "Generate ONE professional YouTube thumbnail image.",
    "Requirements: 16:9 aspect ratio, ultra sharp, high contrast, mobile-readable, cinematic lighting.",
    `Video title context: ${payload.videoTitle}`,
    `Visual style: ${payload.style}`,
    `Primary emotion: ${variation?.emotion || payload.emotion}`,
    `Platform: ${payload.platform}`,
    strategy?.concept?.scene ? `Scene: ${strategy.concept.scene}` : "",
    strategy?.concept?.main ? `Concept: ${strategy.concept.main}` : "",
    hook ? `Include bold, readable overlay text: "${hook}"` : "",
    payload.faceExpression === "Yes"
      ? "Include an expressive human face with strong emotion (if fits the topic)."
      : "Do not include human faces.",
    payload.colorTheme ? `Color direction: ${payload.colorTheme}` : "",
    strategy?.imagePrompt ? `Additional direction: ${strategy.imagePrompt}` : "",
    "No watermarks, no browser UI, no mockup frames — only the thumbnail artwork.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractImagesFromApiResponse(data) {
  const images = [];
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      const mime = inline.mimeType || inline.mime_type || "image/png";
      images.push({
        mimeType: mime,
        base64: inline.data,
        dataUrl: `data:${mime};base64,${inline.data}`,
      });
    }
  }
  return images;
}

async function generateImageOnce(prompt) {
  const apiKey = getApiKey();
  let lastErr;

  for (const model of getImageModels()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: "16:9" },
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error?.message || res.statusText;
        const err = new Error(errMsg);
        if (isModelUnavailable(err)) {
          lastErr = err;
          continue;
        }
        throw err;
      }

      const images = extractImagesFromApiResponse(data);
      if (images.length > 0) return images[0];
      lastErr = new Error("Model returned no image data");
    } catch (err) {
      lastErr = err;
      if (isModelUnavailable(err)) continue;
      throw err;
    }
  }

  throw lastErr || new Error("No image model available");
}

/**
 * @param {object} payload
 * @param {object} strategy
 * @param {{ includeVariations?: boolean }} [opts]
 */
export async function generateThumbnailImages(payload, strategy, opts = {}) {
  const includeVariations = opts.includeVariations !== false;
  const mainPrompt = buildThumbnailImagePrompt(payload, strategy);
  const main = await generateImageOnce(mainPrompt);

  const variations = [];
  if (includeVariations && strategy?.variations?.length) {
    const slice = strategy.variations.slice(0, 3);
    for (const v of slice) {
      try {
        const prompt = buildThumbnailImagePrompt(payload, strategy, v);
        const img = await generateImageOnce(prompt);
        variations.push({ ...v, image: img });
      } catch (err) {
        variations.push({ ...v, image: null, imageError: err.message?.slice(0, 120) });
      }
    }
  }

  return { main, variations };
}

export async function regenerateMainThumbnailImage(payload, strategy) {
  const main = await generateImageOnce(buildThumbnailImagePrompt(payload, strategy));
  return main;
}

export function buildGenericImagePrompt(promptText, options = {}) {
  const aspect = options.aspectRatio || "16:9";
  return [
    "Generate ONE high-quality image from the prompt below.",
    `Aspect ratio: ${aspect}. Ultra sharp, professional composition.`,
    promptText.trim(),
    "No watermarks, no browser UI, no mockup frames — only the artwork.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateImageFromPrompt(promptText, options = {}) {
  if (!promptText?.trim()) throw new Error("Image prompt text is required");
  const enriched = buildGenericImagePrompt(promptText, options);
  return generateImageOnce(enriched);
}

export async function regenerateVariationImages(payload, strategy) {
  const variations = [];
  for (const v of (strategy.variations || []).slice(0, 3)) {
    try {
      const img = await generateImageOnce(buildThumbnailImagePrompt(payload, strategy, v));
      variations.push({ ...v, image: img });
    } catch (err) {
      variations.push({ ...v, image: null, imageError: err.message?.slice(0, 120) });
    }
  }
  return variations;
}

export function friendlyImageError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("GOOGLE_API_KEY")) {
    return "Image generation requires GOOGLE_API_KEY on the server.";
  }
  if (msg.includes("429") || msg.includes("quota")) {
    return "Gemini image quota exceeded. Try again later.";
  }
  if (isModelUnavailable(err)) {
    return "Image model unavailable. Enable Gemini image models in Google AI Studio or set GEMINI_IMAGE_MODEL.";
  }
  return msg.slice(0, 200) || "Image generation failed.";
}
