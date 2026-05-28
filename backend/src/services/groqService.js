import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export const MODELS = {
  heavy: "llama-3.3-70b-versatile",
  fast: "llama-3.1-8b-instant",
  deepseek: "deepseek-r1-distill-llama-70b",
};

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function ensureKey() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
}

export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

/** ~$0.0001 per 1k tokens expressed as ALGO credits for workflow metering */
export function calculateCredits(tokens) {
  return (tokens / 1000) * 0.0001;
}

function pickModel(requested, promptChars) {
  if (requested === MODELS.fast || requested === "llama-3.1-8b") return MODELS.fast;
  if (requested === MODELS.deepseek || requested === "deepseek-r1") return MODELS.deepseek;
  if (promptChars < 800) return MODELS.fast;
  return MODELS.heavy;
}

async function callGroq({ model, systemPrompt, userMessage, temperature, maxTokens }) {
  if (Date.now() < circuitOpenUntil) {
    throw new Error("Groq circuit breaker open — try again in a few seconds");
  }
  ensureKey();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt || "You are a helpful assistant." },
      { role: "user", content: userMessage },
    ],
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 1024,
  });
  consecutiveFailures = 0;
  const text = completion.choices[0]?.message?.content || "";
  const tokensUsed =
    completion.usage?.total_tokens ??
    estimateTokens(systemPrompt) + estimateTokens(userMessage) + estimateTokens(text);
  return { text, tokensUsed, model };
}

export async function runCompletion({ model, systemPrompt, userMessage, temperature, maxTokens }) {
  const chosen = pickModel(model, (systemPrompt?.length || 0) + (userMessage?.length || 0));
  try {
    return await callGroq({ model: chosen, systemPrompt, userMessage, temperature, maxTokens });
  } catch (err) {
    if (err?.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      return callGroq({ model: chosen, systemPrompt, userMessage, temperature, maxTokens });
    }
    consecutiveFailures += 1;
    if (consecutiveFailures >= 3) circuitOpenUntil = Date.now() + 30_000;
    if (chosen !== MODELS.fast) {
      try {
        return await callGroq({
          model: MODELS.fast,
          systemPrompt,
          userMessage,
          temperature,
          maxTokens,
        });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export async function* streamCompletion({ model, systemPrompt, userMessage, temperature, maxTokens }) {
  ensureKey();
  const chosen = pickModel(model, (systemPrompt?.length || 0) + (userMessage?.length || 0));
  const stream = await client.chat.completions.create({
    model: chosen,
    messages: [
      { role: "system", content: systemPrompt || "You are a helpful assistant." },
      { role: "user", content: userMessage },
    ],
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 1024,
    stream: true,
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      full += delta;
      yield { text: delta, done: false };
    }
  }
  yield { text: full, done: true, tokensUsed: estimateTokens(full) + estimateTokens(userMessage) };
}
