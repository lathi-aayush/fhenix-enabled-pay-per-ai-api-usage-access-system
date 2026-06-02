import axios from "axios";

function contentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const t = content.find((c) => c?.type === "text");
    return t?.text ?? "";
  }
  return "";
}

function messagesToGeminiPayload(messages, maxTokens, temperature) {
  const systemParts = messages.filter((m) => m.role === "system");
  const systemInstruction = systemParts
    .map((m) => contentToString(m.content))
    .filter(Boolean)
    .join("\n\n");

  const contents = [];
  for (const m of messages.filter((m) => m.role !== "system")) {
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: contentToString(m.content) }] });
  }

  const generationConfig = { maxOutputTokens: maxTokens };
  if (temperature !== undefined) generationConfig.temperature = temperature;

  const body = { contents, generationConfig };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  return body;
}

function geminiModelPath(model) {
  const m = String(model || "gemini-2.0-flash").trim();
  return m.startsWith("models/") ? m : `models/${m}`;
}

/**
 * Google Gemini generateContent (creator API key) → OpenAI-style chat completion.
 */
export async function forwardGeminiChatCompletion({ apiKey, model, body }) {
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages array required");
  }

  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;
  const payload = messagesToGeminiPayload(messages, maxTokens, temperature);
  const modelPath = geminiModelPath(model || body.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`;

  const resp = await axios.post(url, payload, {
    params: { key: apiKey },
    headers: { "Content-Type": "application/json" },
    timeout: 120000,
    validateStatus: () => true,
  });

  const { data, status } = resp;
  if (status >= 400) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      `Gemini HTTP ${status}`;
    const err = new Error(msg);
    err.status = status === 429 ? 429 : 502;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const meta = data?.usageMetadata || {};

  return {
    id: `gemini-${Date.now()}`,
    model: model || body.model || "gemini",
    choices: [{ message: { role: "assistant", content: text } }],
    usage: {
      prompt_tokens: Number(meta.promptTokenCount ?? 0),
      completion_tokens: Number(meta.candidatesTokenCount ?? 0),
      total_tokens: Number(meta.totalTokenCount ?? 0),
    },
  };
}
