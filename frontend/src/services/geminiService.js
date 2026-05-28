import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_FLASH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

/** Free-tier Flash models — tried in order until one works */
export function getFlashModels() {
  const override = import.meta.env.VITE_GEMINI_MODEL?.trim();
  if (override) return [override, ...DEFAULT_FLASH_MODELS.filter((m) => m !== override)];
  return DEFAULT_FLASH_MODELS;
}

export const FLASH_MODELS = DEFAULT_FLASH_MODELS;
export const FLASH_MODEL = DEFAULT_FLASH_MODELS[0];

const MAX_RETRIES = 2;

function getApiKey() {
  const key = import.meta.env.VITE_GOOGLE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "VITE_GOOGLE_API_KEY is not set. Add your Google AI Studio key to frontend/.env"
    );
  }
  return key;
}

function getClient() {
  return new GoogleGenerativeAI(getApiKey());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isModelUnavailable(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("is not supported") ||
    msg.includes("invalid model")
  );
}

async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && !isModelUnavailable(err)) {
        await sleep(400 * 2 ** attempt);
      } else if (isModelUnavailable(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function modeInstructions(mode) {
  if (mode === "beginner") {
    return (
      "MODE: Beginner — Use clear, concise, single-step instructions. Avoid jargon. " +
      "One primary objective per prompt. Short sentences."
    );
  }
  if (mode === "expert") {
    return (
      "MODE: Expert — Include role engineering, chain-of-thought triggers, strict output formatting rules, " +
      "self-correction loops, edge-case handling, and explicit constraints. Define success criteria."
    );
  }
  return (
    "MODE: Advanced — Multi-step structure, context framing, output constraints, numbered steps, " +
    "and explicit deliverable format."
  );
}

function buildSystemInstruction({ mode, type, category }) {
  return [
    "You are SentinelAI's Advanced Prompt Generator. Produce production-ready prompts only.",
    modeInstructions(mode),
    `CATEGORY: ${category}`,
    `PROMPT TYPE: ${type}`,
    "Output markdown. Be specific and actionable. No filler.",
  ].join("\n");
}

function buildUserMessage({ goal, category, mode, type, extraInstructions, template }) {
  const parts = [
    `Goal: ${goal}`,
    `Category: ${category}`,
    `Mode: ${mode}`,
    `Type: ${type}`,
  ];
  if (template) parts.push(`Template context: ${template}`);
  if (extraInstructions?.trim()) parts.push(`Extra instructions: ${extraInstructions.trim()}`);
  parts.push("Generate the best possible prompt for the user to copy into their AI tool.");
  return parts.join("\n\n");
}

async function streamWithModel(model, systemInstruction, userMessage, onChunk) {
  const client = getClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction,
  });
  const result = await genModel.generateContentStream(userMessage);
  let full = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      full += text;
      onChunk?.(text, full);
    }
  }
  return full;
}

async function onceWithModel(model, systemInstruction, userMessage) {
  const client = getClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction,
  });
  const result = await genModel.generateContent(userMessage);
  return result.response.text();
}

async function streamGenerate({ systemInstruction, userMessage, onChunk, models = getFlashModels() }) {
  let lastErr;
  for (const model of models) {
    try {
      return await withRetry(() =>
        streamWithModel(model, systemInstruction, userMessage, onChunk)
      );
    } catch (err) {
      lastErr = err;
      if (isModelUnavailable(err)) continue;
      throw err;
    }
  }
  throw lastErr;
}

async function generateOnce({ systemInstruction, userMessage, models = getFlashModels() }) {
  let lastErr;
  for (const model of models) {
    try {
      return await withRetry(() => onceWithModel(model, systemInstruction, userMessage));
    } catch (err) {
      lastErr = err;
      if (isModelUnavailable(err)) continue;
      throw err;
    }
  }
  throw lastErr;
}

/**
 * @param {{ goal: string, category: string, mode: string, type: string, extraInstructions?: string, template?: string }} payload
 * @param {(chunk: string, full: string) => void} [onChunk]
 */
export async function generatePrompt(payload, onChunk) {
  const systemInstruction = buildSystemInstruction(payload);
  const userMessage = buildUserMessage(payload);
  return streamGenerate({ systemInstruction, userMessage, onChunk });
}

/**
 * @param {string} existingPrompt
 * @param {(chunk: string, full: string) => void} [onChunk]
 */
export async function enhancePrompt(existingPrompt, onChunk) {
  const systemInstruction = [
    "You improve AI prompts. Return markdown with exactly these sections:",
    "## Enhanced Prompt",
    "(the improved prompt only)",
    "## Improvements",
    "(bullet list explaining clarity, structure, constraints, and ambiguity fixes)",
    modeInstructions("expert"),
  ].join("\n");
  const userMessage = `Improve this prompt:\n\n${existingPrompt}`;
  return streamGenerate({ systemInstruction, userMessage, onChunk });
}

/**
 * @param {string} promptText
 */
export async function analyzePrompt(promptText) {
  const systemInstruction = [
    "Analyze the prompt. Respond with ONLY valid JSON, no markdown fences:",
    '{"qualityScore":0-100,"clarityScore":0-100,"suggestions":["..."],"structureFeedback":"..."}',
  ].join("\n");
  const raw = await generateOnce({
    systemInstruction,
    userMessage: `Analyze:\n\n${promptText}`,
  });
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      qualityScore: 70,
      clarityScore: 70,
      suggestions: ["Could not parse analyzer response. Try again."],
      structureFeedback: raw.slice(0, 500),
    };
  }
}

/**
 * @param {string} promptText
 * @param {number} count
 */
export async function generateVariations(promptText, count = 3) {
  const systemInstruction =
    "Generate alternative prompt variations. Return markdown with numbered sections ## Variation 1, ## Variation 2, etc. Each variation must be a complete usable prompt.";
  const userMessage = `Create ${count} distinct variations of:\n\n${promptText}`;
  return generateOnce({ systemInstruction, userMessage });
}

/**
 * @param {string} promptText
 */
export async function improvePrompt(promptText, onChunk) {
  const systemInstruction = [
    "Refine the prompt for maximum clarity and results. Output only the improved prompt in markdown.",
    modeInstructions("advanced"),
  ].join("\n");
  return streamGenerate({
    systemInstruction,
    userMessage: `Improve:\n\n${promptText}`,
    onChunk,
  });
}

export function friendlyError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("API_KEY") || msg.includes("VITE_GOOGLE")) {
    return "Add VITE_GOOGLE_API_KEY to your frontend .env file.";
  }
  if (msg.includes("429") || msg.includes("quota")) {
    return "Gemini rate limit reached. Wait a moment and try again.";
  }
  if (isModelUnavailable(err)) {
    return "No free Flash model available for this API key. Enable Gemini 2.5 Flash in Google AI Studio.";
  }
  return msg.slice(0, 200) || "Generation failed. Please retry.";
}
