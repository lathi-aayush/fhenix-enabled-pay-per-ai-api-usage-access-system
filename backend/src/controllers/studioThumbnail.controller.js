import {
  friendlyGeminiError,
  generateThumbnailStrategy,
  regenerateVariations,
} from "../services/geminiThumbnailService.js";
import {
  friendlyImageError,
  generateThumbnailImages,
  regenerateMainThumbnailImage,
  regenerateVariationImages,
} from "../services/geminiImageService.js";
import { incrementPromptUsage } from "../services/blog.service.js";

async function attachImages(payload, strategy, generateImages) {
  if (generateImages === false) {
    return { ...strategy, images: null };
  }
  try {
    const images = await generateThumbnailImages(payload, strategy, { includeVariations: false });
    return { ...strategy, images, imageWarning: null };
  } catch (err) {
    console.warn("[studio thumbnail images]", err.message);
    return {
      ...strategy,
      images: null,
      imageWarning: friendlyImageError(err),
    };
  }
}

export async function postThumbnailGenerate(req, res) {
  const {
    videoTitle,
    style = "Cinematic",
    emotion = "Curiosity",
    platform = "YouTube",
    colorTheme = "",
    thumbnailText = "",
    faceExpression = "Yes",
    viralIntensity = 7,
    generateImages = true,
  } = req.body;

  if (!videoTitle?.trim()) {
    return res.status(400).json({ error: "videoTitle is required" });
  }

  const payload = {
    videoTitle: videoTitle.trim(),
    style,
    emotion,
    platform,
    colorTheme: String(colorTheme || "").trim(),
    thumbnailText: String(thumbnailText || "").trim(),
    faceExpression: faceExpression === "No" ? "No" : "Yes",
    viralIntensity: Math.min(10, Math.max(1, Number(viralIntensity) || 7)),
  };

  try {
    let result = await generateThumbnailStrategy(payload);
    result = await attachImages(payload, result, generateImages !== false);
    await incrementPromptUsage(req.user.userId);
    res.json({ result });
  } catch (e) {
    console.error("[studio thumbnail]", e);
    res.status(500).json({ error: friendlyGeminiError(e) });
  }
}

export async function postThumbnailVariations(req, res) {
  const { payload, previousResult, generateImages = true } = req.body;
  if (!payload?.videoTitle?.trim() || !previousResult) {
    return res.status(400).json({ error: "payload and previousResult are required" });
  }
  try {
    let result = await regenerateVariations(payload, previousResult);
    if (generateImages !== false) {
      try {
        const variationImages = await regenerateVariationImages(payload, result);
        result = {
          ...result,
          images: {
            main: previousResult.images?.main || null,
            variations: variationImages,
          },
          imageWarning: null,
        };
      } catch (err) {
        result.imageWarning = friendlyImageError(err);
      }
    }
    await incrementPromptUsage(req.user.userId);
    res.json({ result });
  } catch (e) {
    console.error("[studio thumbnail variations]", e);
    res.status(500).json({ error: friendlyGeminiError(e) });
  }
}

export async function postThumbnailRegenerateImage(req, res) {
  const { payload, previousResult } = req.body;
  if (!payload?.videoTitle?.trim() || !previousResult) {
    return res.status(400).json({ error: "payload and previousResult are required" });
  }
  try {
    const main = await regenerateMainThumbnailImage(payload, previousResult);
    const result = {
      ...previousResult,
      images: {
        main,
        variations: previousResult.images?.variations || [],
      },
      imageWarning: null,
    };
    await incrementPromptUsage(req.user.userId);
    res.json({ result });
  } catch (e) {
    console.error("[studio thumbnail image]", e);
    res.status(500).json({ error: friendlyImageError(e) });
  }
}
