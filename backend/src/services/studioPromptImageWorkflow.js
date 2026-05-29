import { generatePromptOnce, friendlyGeminiError } from "./geminiPromptService.js";
import {
  friendlyImageError,
  generateImageFromPrompt,
  generateThumbnailImages,
} from "./geminiImageService.js";
import {
  generateThumbnailStrategy,
  friendlyGeminiError as friendlyThumbnailError,
} from "./geminiThumbnailService.js";

/** Pull usable image prompt text from markdown prompt generator output. */
export function extractImagePromptText(markdown) {
  const text = String(markdown || "").trim();
  if (!text) return "";

  const enhanced = text.match(/##\s*Enhanced Prompt\s*\n+([\s\S]*?)(?=\n##\s|$)/i);
  if (enhanced?.[1]?.trim()) return enhanced[1].trim();

  const promptSection = text.match(/##\s*(?:Image Prompt|Prompt)\s*\n+([\s\S]*?)(?=\n##\s|$)/i);
  if (promptSection?.[1]?.trim()) return promptSection[1].trim();

  const fenced = text.match(/```(?:markdown)?\n([\s\S]*?)```/);
  if (fenced?.[1]?.trim() && fenced[1].length < 4000) return fenced[1].trim();

  return text.slice(0, 8000);
}

function buildPromptPayload(input) {
  return {
    goal: input.goal?.trim() || input.videoTitle?.trim(),
    category: input.category || "Image Generation",
    mode: input.mode || "advanced",
    type: input.type || "Creative Writing",
    extraInstructions: input.extraInstructions,
    template: input.template,
  };
}

/**
 * Step 1: Advanced Prompt Generator → Step 2: Gemini image render.
 */
export async function runPromptToImageWorkflow(input) {
  const steps = [];
  let promptText = String(input.existingPrompt || "").trim();

  if (!promptText) {
    if (!input.goal?.trim() && !input.videoTitle?.trim()) {
      throw new Error("goal or existingPrompt is required");
    }
    promptText = await generatePromptOnce(buildPromptPayload(input));
    steps.push({
      id: "prompt",
      label: "Advanced Prompt Generator",
      status: "completed",
      output: promptText,
    });
  } else {
    steps.push({
      id: "prompt",
      label: "Use provided prompt",
      status: "completed",
      output: promptText,
    });
  }

  const imagePrompt = extractImagePromptText(promptText);
  let image = null;
  let imageWarning = null;

  if (input.generateImage !== false) {
    try {
      image = await generateImageFromPrompt(imagePrompt, {
        aspectRatio: input.aspectRatio || "16:9",
      });
      steps.push({
        id: "image",
        label: "Image Generator",
        status: "completed",
        image,
      });
    } catch (err) {
      imageWarning = friendlyImageError(err);
      steps.push({
        id: "image",
        label: "Image Generator",
        status: "failed",
        error: imageWarning,
      });
    }
  }

  return {
    workflowType: "prompt-to-image",
    prompt: promptText,
    imagePrompt,
    image,
    imageWarning,
    steps,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Step 1: Prompt Generator → Step 2: Viral Thumbnail strategy → Step 3: Thumbnail image.
 */
export async function runThumbnailPromptWorkflow(input) {
  const steps = [];
  const videoTitle = input.videoTitle?.trim() || input.goal?.trim();
  if (!videoTitle) throw new Error("videoTitle is required");

  let promptText = String(input.existingPrompt || "").trim();
  if (!promptText) {
    promptText = await generatePromptOnce({
      ...buildPromptPayload({ ...input, goal: videoTitle }),
      category: input.category || "Video / YouTube",
      type: input.type || "Creative Writing",
      extraInstructions:
        input.extraInstructions ||
        "Output a concise image-generation prompt suitable for a YouTube thumbnail (16:9, bold hook text, high CTR).",
    });
    steps.push({
      id: "prompt",
      label: "Advanced Prompt Generator",
      status: "completed",
      output: promptText,
    });
  } else {
    steps.push({
      id: "prompt",
      label: "Use provided prompt",
      status: "completed",
      output: promptText,
    });
  }

  const thumbnailPayload = {
    videoTitle,
    style: input.style || "Cinematic",
    emotion: input.emotion || "Curiosity",
    platform: input.platform || "YouTube",
    colorTheme: String(input.colorTheme || "").trim(),
    thumbnailText: String(input.thumbnailText || "").trim(),
    faceExpression: input.faceExpression === "No" ? "No" : "Yes",
    viralIntensity: Math.min(10, Math.max(1, Number(input.viralIntensity) || 7)),
  };

  let strategy = await generateThumbnailStrategy(thumbnailPayload);
  const refined = extractImagePromptText(promptText);
  if (refined) {
    strategy = {
      ...strategy,
      imagePrompt: `${strategy.imagePrompt || ""}\n\nRefined visual direction:\n${refined}`.trim(),
    };
  }
  steps.push({
    id: "thumbnail-strategy",
    label: "Viral Thumbnail AI (strategy)",
    status: "completed",
    output: strategy,
  });

  let images = null;
  let imageWarning = null;
  if (input.generateImages !== false) {
    try {
      images = await generateThumbnailImages(thumbnailPayload, strategy, {
        includeVariations: false,
      });
      steps.push({
        id: "thumbnail-image",
        label: "Thumbnail image render",
        status: "completed",
        image: images?.main,
      });
    } catch (err) {
      imageWarning = friendlyImageError(err);
      steps.push({
        id: "thumbnail-image",
        label: "Thumbnail image render",
        status: "failed",
        error: imageWarning,
      });
    }
  }

  return {
    workflowType: "prompt-to-thumbnail",
    prompt: promptText,
    imagePrompt: refined || strategy.imagePrompt,
    result: strategy,
    images,
    imageWarning,
    steps,
    completedAt: new Date().toISOString(),
  };
}

export function friendlyWorkflowError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("GOOGLE_API_KEY")) return friendlyGeminiError(err);
  if (msg.includes("thumbnail") || msg.includes("videoTitle")) return friendlyThumbnailError(err);
  return friendlyGeminiError(err) || friendlyImageError(err) || msg.slice(0, 200);
}
