import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_FLASH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const MAX_RETRIES = 2;

function getApiKey() {
  const key = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new Error("GOOGLE_API_KEY is not set on the server");
  }
  return key;
}

function getFlashModels() {
  const override = (process.env.GEMINI_MODEL || "").trim();
  if (override) return [override, ...DEFAULT_FLASH_MODELS.filter((m) => m !== override)];
  return DEFAULT_FLASH_MODELS;
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
  const client = new GoogleGenerativeAI(getApiKey());
  const genModel = client.getGenerativeModel({ model, systemInstruction });
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
  const client = new GoogleGenerativeAI(getApiKey());
  const genModel = client.getGenerativeModel({ model, systemInstruction });
  const result = await genModel.generateContent(userMessage);
  return result.response.text();
}

async function streamGenerate({ systemInstruction, userMessage, onChunk, models = getFlashModels() }) {
  let lastErr;
  for (const model of models) {
    try {
      return await withRetry(() => streamWithModel(model, systemInstruction, userMessage, onChunk));
    } catch (err) {
      lastErr = err;
      if (isModelUnavailable(err)) continue;
      throw err;
    }
  }
  throw lastErr;
}

export async function generateOnce({ systemInstruction, userMessage, models = getFlashModels() }) {
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

export async function generatePrompt(payload, onChunk) {
  return streamGenerate({
    systemInstruction: buildSystemInstruction(payload),
    userMessage: buildUserMessage(payload),
    onChunk,
  });
}

/** Non-streaming prompt generation (workflows, chaining). */
export async function generatePromptOnce(payload) {
  return generateOnce({
    systemInstruction: buildSystemInstruction(payload),
    userMessage: buildUserMessage(payload),
  });
}

export async function enhancePrompt(existingPrompt, onChunk) {
  const systemInstruction = [
    "You improve AI prompts. Return markdown with exactly these sections:",
    "## Enhanced Prompt",
    "(the improved prompt only)",
    "## Improvements",
    "(bullet list explaining clarity, structure, constraints, and ambiguity fixes)",
    modeInstructions("expert"),
  ].join("\n");
  return streamGenerate({
    systemInstruction,
    userMessage: `Improve this prompt:\n\n${existingPrompt}`,
    onChunk,
  });
}

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

export async function generateVariations(promptText, count = 3) {
  const systemInstruction =
    "Generate alternative prompt variations. Return markdown with numbered sections ## Variation 1, ## Variation 2, etc. Each variation must be a complete usable prompt.";
  return generateOnce({
    systemInstruction,
    userMessage: `Create ${count} distinct variations of:\n\n${promptText}`,
  });
}

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

export function friendlyGeminiError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("GOOGLE_API_KEY") || msg.includes("GEMINI_API_KEY")) {
    return "Add GOOGLE_API_KEY to backend/.env (Google AI Studio), then restart the backend server.";
  }
  if (msg.includes("429") || msg.includes("quota")) {
    return "Gemini rate limit reached. Wait a moment and try again.";
  }
  if (isModelUnavailable(err)) {
    return "No free Flash model available. Check server GEMINI_MODEL setting.";
  }
  return msg.slice(0, 200) || "Generation failed. Please retry.";
}
