import { generateOnce, friendlyGeminiError } from "./geminiPromptService.js";

export { friendlyGeminiError };

const SYSTEM_INSTRUCTION = `You are a world-class YouTube thumbnail strategist and viral content expert.

Generate highly clickable thumbnail strategies optimized for CTR, emotional engagement, and mobile readability.

Focus on: emotional triggers, cinematic composition, bold contrast, curiosity gaps, visual hierarchy, creator economy trends.

Respond with ONLY valid JSON (no markdown fences) matching this exact shape:
{
  "concept": {
    "main": "string",
    "scene": "string",
    "subjectPlacement": "string",
    "background": "string"
  },
  "thumbnailText": {
    "mainHook": "string",
    "alternatives": ["string"],
    "typographyNotes": "string"
  },
  "emotionalStrategy": "string",
  "compositionLayout": "string",
  "colorPsychology": "string",
  "ctrAnalysis": {
    "ctrScore": 0-100,
    "emotionalIntensity": 0-100,
    "curiosityScore": 0-100,
    "attentionScore": 0-100,
    "mobileReadability": 0-100,
    "summary": "string"
  },
  "colorStrategy": {
    "palette": ["color name"],
    "contrast": "string",
    "reasoning": "string"
  },
  "imagePrompt": "string (detailed cinematic prompt for image AI)",
  "variations": [
    {
      "label": "Variation 1",
      "emotion": "string",
      "hook": "string",
      "composition": "string",
      "concept": "string"
    }
  ],
  "titleSuggestions": {
    "viral": ["string"],
    "curiosity": ["string"],
    "authority": ["string"],
    "highClick": ["string"]
  },
  "attentionHooks": ["string"]
}

Provide exactly 3 items in variations array. Each score 0-100.`;

function buildUserMessage(payload) {
  const {
    videoTitle,
    style,
    emotion,
    platform,
    colorTheme,
    thumbnailText,
    faceExpression,
    viralIntensity,
  } = payload;
  return [
    `Video title: ${videoTitle}`,
    `Thumbnail style: ${style}`,
    `Primary emotion: ${emotion}`,
    `Platform: ${platform}`,
    colorTheme ? `Color theme: ${colorTheme}` : "",
    thumbnailText ? `Custom thumbnail text: ${thumbnailText}` : "",
    `Face in thumbnail: ${faceExpression}`,
    `Viral intensity (1-10): ${viralIntensity}`,
    "Generate the full JSON strategy now.",
  ]
    .filter(Boolean)
    .join("\n");
}

function clampScore(n) {
  return Math.min(100, Math.max(0, Number(n) || 0));
}

function normalizeResult(raw, payload) {
  const base = {
    concept: {
      main: "High-contrast focal subject with bold hook text",
      scene: "Dramatic close-up scene aligned to the video topic",
      subjectPlacement: "Rule-of-thirds, subject on left, text on right",
      background: "Blurred contextual background with strong color separation",
    },
    thumbnailText: {
      mainHook: payload.thumbnailText || "YOU WON'T BELIEVE THIS",
      alternatives: ["WATCH BEFORE IT'S GONE", "THE TRUTH REVEALED"],
      typographyNotes: "Bold sans-serif, 3-5 words max, high stroke contrast",
    },
    emotionalStrategy: "Lead with curiosity and urgency aligned to the title.",
    compositionLayout: "Single hero subject, oversized text, minimal clutter.",
    colorPsychology: "Complementary colors for maximum thumb-stop power.",
    ctrAnalysis: {
      ctrScore: 72,
      emotionalIntensity: 70,
      curiosityScore: 75,
      attentionScore: 68,
      mobileReadability: 80,
      summary: "Strong mobile readability; increase contrast on text for small screens.",
    },
    colorStrategy: {
      palette: ["Electric blue", "Deep black", "Accent red"],
      contrast: "Subject lit warm against cool background",
      reasoning: "Contrast draws the eye on mobile feeds",
    },
    imagePrompt:
      "Cinematic 16:9 YouTube thumbnail, hyper-realistic, dramatic lighting, shallow depth of field, bold typography space on right, ultra sharp, 4K",
    variations: [
      {
        label: "Variation 1",
        emotion: "Shock",
        hook: "THIS CHANGES EVERYTHING",
        composition: "Close-up face, wide eyes",
        concept: "Reaction-driven layout",
      },
      {
        label: "Variation 2",
        emotion: "Curiosity",
        hook: "SECRET REVEALED",
        composition: "Split screen before/after",
        concept: "Mystery object partially hidden",
      },
      {
        label: "Variation 3",
        emotion: "Urgency",
        hook: "LAST CHANCE",
        composition: "Countdown visual element",
        concept: "Timer + bold red accents",
      },
    ],
    titleSuggestions: {
      viral: [payload.videoTitle],
      curiosity: [`What Nobody Tells You About ${payload.videoTitle?.slice(0, 40)}`],
      authority: [`The Complete Guide to ${payload.videoTitle?.slice(0, 40)}`],
      highClick: [`I Tried ${payload.videoTitle?.slice(0, 40)} — Here's What Happened`],
    },
    attentionHooks: [
      "Open with a pattern interrupt in the first 3 seconds",
      "Use a curiosity gap in the title and thumbnail text",
    ],
    generatedAt: new Date().toISOString(),
    input: payload,
  };

  if (!raw || typeof raw !== "object") return base;

  if (raw.ctrAnalysis) {
    raw.ctrAnalysis.ctrScore = clampScore(raw.ctrAnalysis.ctrScore);
    raw.ctrAnalysis.emotionalIntensity = clampScore(raw.ctrAnalysis.emotionalIntensity);
    raw.ctrAnalysis.curiosityScore = clampScore(raw.ctrAnalysis.curiosityScore);
    raw.ctrAnalysis.attentionScore = clampScore(raw.ctrAnalysis.attentionScore);
    raw.ctrAnalysis.mobileReadability = clampScore(raw.ctrAnalysis.mobileReadability);
  }
  return { ...base, ...raw, generatedAt: new Date().toISOString(), input: payload };
}

export async function generateThumbnailStrategy(payload) {
  const raw = await generateOnce({
    systemInstruction: SYSTEM_INSTRUCTION,
    userMessage: buildUserMessage(payload),
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
  });
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return normalizeResult(parsed, payload);
  } catch {
    return normalizeResult(null, payload);
  }
}

export async function regenerateVariations(payload, previousResult) {
  const systemInstruction = `${SYSTEM_INSTRUCTION}
Return ONLY JSON: { "variations": [ ...3 items with label, emotion, hook, composition, concept ] }`;
  const userMessage = [
    buildUserMessage(payload),
    "Previous concept:",
    JSON.stringify(previousResult?.concept || {}),
    "Generate 3 NEW alternative thumbnail concepts with different emotions and hooks.",
  ].join("\n\n");
  const raw = await generateOnce({ systemInstruction, userMessage });
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.variations?.length) {
      return { ...previousResult, variations: parsed.variations.slice(0, 3) };
    }
  } catch {
    /* fall through */
  }
  return previousResult;
}
