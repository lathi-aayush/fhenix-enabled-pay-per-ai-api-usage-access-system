import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export const HEAVY = "llama-3.3-70b-versatile";
export const FAST = "llama-3.1-8b-instant";

function ensureKey() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }
}

/**
 * Stream markdown blog body. Caller must set SSE headers and pipe chunks.
 * @returns {AsyncIterable<{ text: string }>}
 */
export async function generateBlogStream({ topic, keywords, tone, targetAudience, wordCount, brandVoice }) {
  ensureKey();
  const kw = Array.isArray(keywords) ? keywords.join(", ") : "";
  const system = `You are an expert blog writer. Output valid Markdown only (headings ##, paragraphs, lists). No preamble or meta commentary.`;
  const user = `Write a blog post.

Topic: ${topic}
Keywords to weave in naturally: ${kw}
Tone: ${tone}
Target audience: ${targetAudience || "general readers"}
Approximate length: ~${wordCount} words
Brand voice / style notes: ${brandVoice || "clear, professional"}

Structure with a compelling intro, substantive sections with H2s, and a concise conclusion.`;

  const stream = await groq.chat.completions.create({
    model: HEAVY,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: Math.min(8192, Math.max(1024, Math.ceil(wordCount * 1.5))),
    stream: true,
  });

  return stream;
}

export async function generateHashtags({ topic, keywords, platform }) {
  ensureKey();
  const kw = Array.isArray(keywords) ? keywords.join(", ") : String(keywords || "");
  const completion = await groq.chat.completions.create({
    model: FAST,
    messages: [
      {
        role: "user",
        content: `Generate 8-12 relevant hashtags for a ${platform || "social"} post about: "${topic}". Keywords: ${kw}. Reply with a JSON array of strings only, e.g. ["#ai","#dev"]`,
      },
    ],
    temperature: 0.5,
    max_tokens: 256,
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "[]";
  try {
    const parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```$/, "").trim());
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(/[\s,]+/)
      .filter((t) => t.startsWith("#"))
      .slice(0, 12);
  }
}

export async function generateMetadata({ title, content }) {
  ensureKey();
  const completion = await groq.chat.completions.create({
    model: FAST,
    messages: [
      {
        role: "user",
        content: `Given this blog title and markdown body, respond with a single JSON object only (no markdown fence):
{"metaDescription":"string max 155 chars","seoScore": number 0-100}
Title: ${title}
Body excerpt: ${String(content).slice(0, 8000)}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 400,
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  let obj;
  try {
    obj = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```$/, "").trim());
  } catch {
    obj = { metaDescription: raw.slice(0, 155), seoScore: 70 };
  }
  return {
    metaDescription: String(obj.metaDescription || "").slice(0, 155),
    seoScore: Math.min(100, Math.max(0, Number(obj.seoScore) || 75)),
  };
}

export async function generateTitleSuggestions({ topic, tone }) {
  ensureKey();
  const completion = await groq.chat.completions.create({
    model: FAST,
    messages: [
      {
        role: "user",
        content: `Suggest exactly 5 compelling blog titles for topic "${topic}" with tone "${tone}". JSON array of 5 strings only.`,
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "[]";
  try {
    const parsed = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```$/, "").trim());
    return Array.isArray(parsed) ? parsed.slice(0, 5).map(String) : [];
  } catch {
    return raw
      .split(/\n/)
      .map((l) => l.replace(/^[\d.\-\s"]+/, "").replace(/"$/, ""))
      .filter(Boolean)
      .slice(0, 5);
  }
}

/**
 * Turn workflow research / transcript / summary into publish-ready markdown (non-streaming).
 */
export async function generateBlogFromSource({
  topic,
  sourceMaterial,
  keywords = [],
  tone = "professional",
  targetAudience = "",
  wordCount = 1000,
  brandVoice = "",
}) {
  ensureKey();
  const kw = Array.isArray(keywords) ? keywords.join(", ") : "";
  const completion = await groq.chat.completions.create({
    model: HEAVY,
    messages: [
      {
        role: "system",
        content: `You are an expert blog writer for SentinelAI Studio. Output valid Markdown only (H1 title as #, sections with ##, paragraphs, bullet lists). No preamble, no "here is your post". Content must be publish-ready: engaging intro, substantive body, clear conclusion, optional FAQ. SEO-friendly headings.`,
      },
      {
        role: "user",
        content: `Write a complete blog post from this source material.

Topic / working title: ${topic}
Keywords: ${kw}
Tone: ${tone}
Audience: ${targetAudience || "general readers"}
Target length: ~${wordCount} words
Brand voice: ${brandVoice || "clear, authoritative"}

Source material (research, transcript, notes):
${String(sourceMaterial).slice(0, 14000)}`,
      },
    ],
    temperature: 0.7,
    max_tokens: Math.min(8192, Math.max(1500, Math.ceil(wordCount * 1.6))),
  });
  let body = completion.choices[0]?.message?.content?.trim() || "";
  body = body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return body;
}

export async function generateSocialSnippets({ content }) {
  ensureKey();
  const completion = await groq.chat.completions.create({
    model: HEAVY,
    messages: [
      {
        role: "user",
        content: `From this markdown article, write:
1) A LinkedIn post (2-4 short paragraphs, professional)
2) A Twitter/X post (max 280 chars)

Reply JSON only: {"linkedin":"...","twitter":"..."}
Article:\n${String(content).slice(0, 12000)}`,
      },
    ],
    temperature: 0.6,
    max_tokens: 700,
  });
  const raw = completion.choices[0]?.message?.content?.trim() || "{}";
  try {
    const obj = JSON.parse(raw.replace(/^```json?\s*/i, "").replace(/```$/, "").trim());
    return {
      linkedin: String(obj.linkedin || "").slice(0, 3000),
      twitter: String(obj.twitter || "").slice(0, 280),
    };
  } catch {
    return { linkedin: "", twitter: "" };
  }
}

export { groq };
