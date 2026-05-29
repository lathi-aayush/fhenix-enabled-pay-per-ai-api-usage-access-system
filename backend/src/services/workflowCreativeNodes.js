import { generatePromptOnce } from "./geminiPromptService.js";
import { generateImageFromPrompt, friendlyImageError } from "./geminiImageService.js";
import { extractImagePromptText } from "./studioPromptImageWorkflow.js";

const PROMPT_CREDITS = 0.004;
const IMAGE_CREDITS = 0.006;

export function formatCreativeNodeOutput(payload) {
  return JSON.stringify(payload, null, 2);
}

export function parseCreativeNodeOutput(text) {
  try {
    const parsed = JSON.parse(String(text || ""));
    if (parsed && (parsed.image || parsed.prompt)) return parsed;
  } catch {
    /* plain text from upstream */
  }
  return null;
}

/**
 * Advanced Prompt Generator step (Gemini).
 */
export async function executePromptGenNode(node, upstream) {
  const goal = String(upstream || node.data?.value || node.data?.goal || "").trim();
  if (!goal) throw new Error("Prompt Generator node needs input text (connect an Input node)");

  const promptText = await generatePromptOnce({
    goal,
    category: node.data?.category || "Image Generation",
    mode: node.data?.mode || "advanced",
    type: node.data?.type || "Creative Writing",
    extraInstructions: node.data?.extraInstructions || "",
    template: node.data?.template || "",
  });

  const payload = {
    kind: "promptGen",
    prompt: promptText,
    goal,
    category: node.data?.category || "Image Generation",
  };

  return {
    output: formatCreativeNodeOutput(payload),
    creativePayload: payload,
    tokensUsed: Math.ceil(promptText.length / 4),
    creditsDeducted: node.data?.estimatedCredits ?? PROMPT_CREDITS,
  };
}

/**
 * Image Generator step (Gemini) — uses upstream prompt text.
 */
export async function executeImageGenNode(node, upstream) {
  const parsed = parseCreativeNodeOutput(upstream);
  const rawPrompt = parsed?.prompt || String(upstream || "").trim();
  if (!rawPrompt) throw new Error("Image Generator needs a prompt (connect Prompt Generator or Input)");

  const imagePrompt = extractImagePromptText(rawPrompt);
  let image = null;
  let imageWarning = null;

  try {
    image = await generateImageFromPrompt(imagePrompt, {
      aspectRatio: node.data?.aspectRatio || "16:9",
    });
  } catch (err) {
    imageWarning = friendlyImageError(err);
  }

  const payload = {
    kind: "imageGen",
    prompt: rawPrompt,
    imagePrompt,
    image: image
      ? { mimeType: image.mimeType, dataUrl: image.dataUrl }
      : null,
    imageWarning,
  };

  const displayText = imageWarning
    ? `Image generation failed: ${imageWarning}\n\nPrompt used:\n${imagePrompt.slice(0, 2000)}`
    : `Image generated (${node.data?.aspectRatio || "16:9"}).\n\nPrompt:\n${imagePrompt.slice(0, 1500)}`;

  return {
    output: formatCreativeNodeOutput(payload),
    displayOutput: displayText,
    creativePayload: payload,
    tokensUsed: Math.ceil(imagePrompt.length / 4) + (image ? 500 : 0),
    creditsDeducted: node.data?.estimatedCredits ?? IMAGE_CREDITS,
  };
}
