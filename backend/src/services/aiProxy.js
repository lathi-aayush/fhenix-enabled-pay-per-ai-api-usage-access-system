import axios from "axios";

function openAiStyleMessages(body) {
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages array required");
  }
  return messages;
}

function contentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const t = content.find((c) => c?.type === "text");
    return t?.text ?? "";
  }
  return "";
}

/**
 * Forwards a chat-style request to Groq, OpenAI, or Anthropic.
 * Accepts an OpenAI-compatible { messages, model?, max_tokens?, temperature? } body.
 */
export async function forwardChatCompletion({ provider, apiKey, model, body }) {
  const messages = openAiStyleMessages(body);
  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;

  if (provider === "groq" || provider === "openai" || provider === "together") {
    const url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : provider === "together"
          ? "https://api.together.xyz/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";
    const payload = {
      model: model || body.model,
      messages,
      max_tokens: maxTokens,
    };
    if (temperature !== undefined) payload.temperature = temperature;
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
      validateStatus: () => true,
    });
    const { data, status } = resp;
    if (status >= 400) {
      const msg =
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : null) ||
        `HTTP ${status}`;
      const err = new Error(msg);
      err.status = status === 429 ? 429 : 502;
      throw err;
    }
    if (data?.error) {
      const msg = data.error?.message || JSON.stringify(data.error);
      const err = new Error(msg);
      err.status = 502;
      throw err;
    }
    if (!data?.choices) {
      const err = new Error("Unexpected provider response");
      err.status = 502;
      throw err;
    }
    return data;
  }

  if (provider === "anthropic") {
    const systemParts = messages.filter((m) => m.role === "system");
    const system = systemParts.map((m) => contentToString(m.content)).filter(Boolean).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const anthropicMessages = [];
    for (const m of rest) {
      const role = m.role === "assistant" ? "assistant" : "user";
      anthropicMessages.push({
        role,
        content: contentToString(m.content),
      });
    }
    const resp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model || body.model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
        ...(temperature !== undefined ? { temperature } : {}),
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 120000,
        validateStatus: () => true,
      }
    );
    const { data, status } = resp;
    if (status >= 400) {
      const err = new Error(data?.error?.message || `HTTP ${status}`);
      err.status = status === 429 ? 429 : 502;
      throw err;
    }
    if (data?.error) {
      const err = new Error(data.error?.message || "Anthropic error");
      err.status = 502;
      throw err;
    }
    const text =
      data?.content?.map((b) => (b.type === "text" ? b.text : "")).join("") || "";
    return {
      id: data.id,
      model: data.model,
      choices: [{ message: { role: "assistant", content: text } }],
      usage: data.usage,
    };
  }

  const err = new Error("Unsupported AI provider");
  err.status = 500;
  throw err;
}
