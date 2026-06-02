import axios from "axios";
import { createParser } from "eventsource-parser";
import {
  isOpenAiCompatibleProvider,
  OPENAI_COMPAT_CHAT_URL,
  openAiCompatExtraHeaders,
} from "../constants/aiProviders.js";
import { forwardGeminiChatCompletion } from "./geminiMarketplaceProxy.js";

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

function resolveChatCompletionsUrl(provider, customEndpointUrl) {
  if (provider === "custom") {
    const base = String(customEndpointUrl || "").replace(/\/+$/, "");
    if (!base) throw Object.assign(new Error("Custom endpoint URL not configured"), { status: 500 });
    return `${base}/chat/completions`;
  }
  const url = OPENAI_COMPAT_CHAT_URL[provider];
  if (!url) {
    const err = new Error(`Unsupported AI provider: ${provider}`);
    err.status = 500;
    throw err;
  }
  return url;
}

async function postOpenAiCompatibleChat({ provider, apiKey, model, body, stream = false }) {
  const messages = openAiStyleMessages(body);
  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;
  const url = resolveChatCompletionsUrl(provider, body.customEndpointUrl);

  const payload = {
    model: model || body.model,
    messages,
    max_tokens: maxTokens,
  };
  if (temperature !== undefined) payload.temperature = temperature;
  if (stream) {
    payload.stream = true;
    payload.stream_options = { include_usage: true };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...openAiCompatExtraHeaders(provider),
  };

  return axios.post(url, payload, {
    headers,
    timeout: 120000,
    responseType: stream ? "stream" : "json",
    validateStatus: () => true,
  });
}

function throwProviderHttpError(data, status) {
  const msg =
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : null) ||
    `HTTP ${status}`;
  const err = new Error(msg);
  err.status = status === 429 ? 429 : 502;
  throw err;
}

async function forwardOpenAiCompatible({ provider, apiKey, model, body, customEndpointUrl }) {
  const resp = await postOpenAiCompatibleChat({
    provider,
    apiKey,
    model,
    body: { ...body, customEndpointUrl },
    stream: false,
  });

  const { data, status } = resp;
  if (status >= 400) throwProviderHttpError(data, status);
  if (data?.error) {
    const err = new Error(data.error?.message || JSON.stringify(data.error));
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

async function forwardAnthropic({ apiKey, model, body }) {
  const messages = openAiStyleMessages(body);
  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;

  const systemParts = messages.filter((m) => m.role === "system");
  const system = systemParts.map((m) => contentToString(m.content)).filter(Boolean).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const anthropicMessages = [];
  for (const m of rest) {
    const role = m.role === "assistant" ? "assistant" : "user";
    anthropicMessages.push({ role, content: contentToString(m.content) });
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

  const text = data?.content?.map((b) => (b.type === "text" ? b.text : "")).join("") || "";
  return {
    id: data.id,
    model: data.model,
    choices: [{ message: { role: "assistant", content: text } }],
    usage: data.usage,
  };
}

/**
 * Forwards a chat-style request to a listed marketplace provider.
 * Accepts OpenAI-compatible { messages, model?, max_tokens?, temperature? } body.
 */
export async function forwardChatCompletion({ provider, apiKey, model, body, customEndpointUrl }) {
  if (provider === "gemini") {
    return forwardGeminiChatCompletion({ apiKey, model, body });
  }
  if (provider === "anthropic") {
    return forwardAnthropic({ apiKey, model, body });
  }
  if (isOpenAiCompatibleProvider(provider) || provider === "custom") {
    return forwardOpenAiCompatible({ provider, apiKey, model, body, customEndpointUrl });
  }

  const err = new Error(`Unsupported AI provider: ${provider}`);
  err.status = 500;
  throw err;
}

/**
 * Streams OpenAI-compatible providers; Anthropic native stream; Gemini buffers one chunk.
 */
export async function forwardChatCompletionStream(
  { provider, apiKey, model, body, customEndpointUrl },
  req,
  res
) {
  const messages = openAiStyleMessages(body);
  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;
  let fullContent = "";
  let usage = null;

  if (provider === "gemini") {
    const data = await forwardGeminiChatCompletion({ apiKey, model, body });
    const text = data?.choices?.[0]?.message?.content || "";
    fullContent = text;
    usage = data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : null;
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return { content: fullContent, usage };
  }

  if (isOpenAiCompatibleProvider(provider) || provider === "custom") {
    const url = resolveChatCompletionsUrl(provider, customEndpointUrl);
    const payload = {
      model: model || body.model,
      messages,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (temperature !== undefined) payload.temperature = temperature;

    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...openAiCompatExtraHeaders(provider),
      },
      responseType: "stream",
      timeout: 120000,
      validateStatus: () => true,
    });

    if (resp.status >= 400) {
      let errBody = "";
      resp.data.on("data", (chunk) => {
        errBody += chunk.toString();
      });
      await new Promise((r) => resp.data.on("end", r));
      try {
        const d = JSON.parse(errBody);
        throw new Error(d?.error?.message || d?.error || `HTTP ${resp.status}`);
      } catch (e) {
        if (e.message.startsWith("HTTP")) throw e;
        throw new Error(`HTTP ${resp.status}: ${errBody}`);
      }
    }

    let buffer = "";
    resp.data.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            const textDelta = parsed.choices?.[0]?.delta?.content || "";
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }
            if (textDelta) {
              fullContent += textDelta;
              res.write(
                `data: ${JSON.stringify({ choices: [{ delta: { content: textDelta } }] })}\n\n`
              );
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    });

    return new Promise((resolve, reject) => {
      resp.data.on("end", () => {
        res.end();
        resolve({ content: fullContent, usage });
      });
      resp.data.on("error", (err) => {
        res.end();
        reject(err);
      });
      req?.on("close", () => resp.data.destroy());
    });
  }

  if (provider === "anthropic") {
    const systemParts = messages.filter((m) => m.role === "system");
    const system = systemParts.map((m) => contentToString(m.content)).filter(Boolean).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const anthropicMessages = [];
    for (const m of rest) {
      const role = m.role === "assistant" ? "assistant" : "user";
      anthropicMessages.push({ role, content: contentToString(m.content) });
    }

    const resp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model || body.model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
        ...(temperature !== undefined ? { temperature } : {}),
        stream: true,
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        responseType: "stream",
        timeout: 120000,
        validateStatus: () => true,
      }
    );

    if (resp.status >= 400) {
      let errBody = "";
      resp.data.on("data", (chunk) => {
        errBody += chunk.toString();
      });
      await new Promise((r) => resp.data.on("end", r));
      try {
        const d = JSON.parse(errBody);
        throw new Error(d?.error?.message || d?.error || `HTTP ${resp.status}`);
      } catch (e) {
        if (e.message.startsWith("HTTP")) throw e;
        throw new Error(`HTTP ${resp.status}: ${errBody}`);
      }
    }

    let completionTokens = 0;
    const parser = createParser((event) => {
      if (event.type !== "event") return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          fullContent += parsed.delta.text;
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })}\n\n`
          );
        }
        if (parsed.type === "message_delta" && parsed.usage) {
          completionTokens += parsed.usage.output_tokens || 0;
        }
        if (parsed.type === "message_start" && parsed.message?.usage) {
          usage = { input_tokens: parsed.message.usage.input_tokens || 0 };
        }
      } catch {
        /* ignore */
      }
    });

    resp.data.on("data", (chunk) => parser.feed(chunk.toString("utf8")));

    return new Promise((resolve, reject) => {
      resp.data.on("end", () => {
        if (usage) {
          usage.output_tokens = completionTokens;
          usage.total_tokens = (usage.input_tokens || 0) + completionTokens;
        }
        res.write("data: [DONE]\n\n");
        res.end();
        resolve({ content: fullContent, usage });
      });
      resp.data.on("error", (err) => {
        res.end();
        reject(err);
      });
      req?.on("close", () => resp.data.destroy());
    });
  }

  const err = new Error(`Unsupported AI provider: ${provider}`);
  err.status = 500;
  throw err;
}
