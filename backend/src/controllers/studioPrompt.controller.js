import {
  analyzePrompt,
  enhancePrompt,
  friendlyGeminiError,
  generatePrompt,
  generateVariations,
  improvePrompt,
} from "../services/geminiPromptService.js";
import { incrementPromptUsage } from "../services/blog.service.js";

function sseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function writeChunk(res, text) {
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
}

function writeError(res, message) {
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
}

async function streamAction(userId, res, runStream) {
  sseHeaders(res);
  try {
    await runStream((delta) => writeChunk(res, delta));
    await incrementPromptUsage(userId);
    res.write("data: [DONE]\n\n");
  } catch (e) {
    console.error("[studio prompt]", e);
    writeError(res, friendlyGeminiError(e));
    res.write("data: [DONE]\n\n");
  }
  res.end();
}

export async function postPromptGenerate(req, res) {
  const { goal, category, mode, type, extraInstructions, template } = req.body;
  if (!goal?.trim()) {
    return res.status(400).json({ error: "goal is required" });
  }
  await streamAction(req.user.userId, res, (onChunk) =>
    generatePrompt(
      {
        goal: goal.trim(),
        category: category || "General",
        mode: mode || "advanced",
        type: type || "Instruction",
        extraInstructions,
        template,
      },
      (_c, full) => onChunk(full)
    )
  );
}

export async function postPromptEnhance(req, res) {
  const { prompt } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  await streamAction(req.user.userId, res, (onChunk) =>
    enhancePrompt(prompt.trim(), (_c, full) => onChunk(full))
  );
}

export async function postPromptImprove(req, res) {
  const { prompt } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  await streamAction(req.user.userId, res, (onChunk) =>
    improvePrompt(prompt.trim(), (_c, full) => onChunk(full))
  );
}

export async function postPromptAnalyze(req, res) {
  const { prompt } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  try {
    const analysis = await analyzePrompt(prompt.trim());
    await incrementPromptUsage(req.user.userId);
    res.json({ analysis });
  } catch (e) {
    console.error("[studio prompt analyze]", e);
    res.status(500).json({ error: friendlyGeminiError(e) });
  }
}

export async function postPromptVariations(req, res) {
  const { prompt, count } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  try {
    const text = await generateVariations(prompt.trim(), Number(count) || 3);
    await incrementPromptUsage(req.user.userId);
    res.json({ text });
  } catch (e) {
    console.error("[studio prompt variations]", e);
    res.status(500).json({ error: friendlyGeminiError(e) });
  }
}
