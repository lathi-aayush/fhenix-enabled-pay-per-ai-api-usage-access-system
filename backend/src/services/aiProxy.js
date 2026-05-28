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

import { createParser } from "eventsource-parser";

/**
 * Forwards a chat-style request to the AI provider and pipes an SSE stream to the Express response.
 * Returns a promise that resolves with { content, usage } when the stream finishes.
 */
export async function forwardChatCompletionStream({ provider, apiKey, model, body }, req, res) {
  const messages = openAiStyleMessages(body);
  const maxTokens = body.max_tokens ?? 1024;
  const temperature = body.temperature;
  let fullContent = "";
  let usage = null;

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
      stream: true,
      stream_options: { include_usage: true }
    };
    if (temperature !== undefined) payload.temperature = temperature;

    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 120000,
      validateStatus: () => true,
    });

    if (resp.status >= 400) {
      let errBody = "";
      resp.data.on("data", chunk => errBody += chunk.toString());
      await new Promise(r => resp.data.on("end", r));
      try {
        const d = JSON.parse(errBody);
        throw new Error(d?.error?.message || d?.error || `HTTP ${resp.status}`);
      } catch {
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
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              res.write(`data: [DONE]\n\n`);
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              let textDelta = "";

              if (provider === "anthropic") {
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  textDelta = parsed.delta.text;
                } else if (parsed.type === "message_delta" && parsed.usage) {
                  usage.completionTokens = parsed.usage.output_tokens || 0;
                }
              } else {
                textDelta = parsed.choices?.[0]?.delta?.content || "";
                if (parsed.usage) {
                  usage = {
                    promptTokens: parsed.usage.prompt_tokens || 0,
                    completionTokens: parsed.usage.completion_tokens || 0,
                    totalTokens: parsed.usage.total_tokens || 0,
                  };
                }
              }

              if (textDelta) {
                fullContent += textDelta;
                res.write(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { content: textDelta } }],
                  })}\n\n`
                );
              }
            } catch (e) {
              // ignore parse errors
            }
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
      req?.on("close", () => {
        resp.data.destroy();
      });
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
      resp.data.on("data", chunk => errBody += chunk.toString());
      await new Promise(r => resp.data.on("end", r));
      try {
        const d = JSON.parse(errBody);
        throw new Error(d?.error?.message || d?.error || `HTTP ${resp.status}`);
      } catch {
        throw new Error(`HTTP ${resp.status}: ${errBody}`);
      }
    }

    let completionTokens = 0;
    const parser = createParser((event) => {
      if (event.type === "event") {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })}\n\n`);
          }
          if (parsed.type === "message_delta" && parsed.usage) {
             completionTokens += (parsed.usage.output_tokens || 0);
          }
          if (parsed.type === "message_start" && parsed.message?.usage) {
             usage = { prompt_tokens: parsed.message.usage.input_tokens || 0 };
          }
        } catch (e) {
          console.error("Error parsing anthropic SSE data", e);
        }
      }
    });

    resp.data.on("data", (chunk) => {
      parser.feed(chunk.toString("utf8"));
    });

    return new Promise((resolve, reject) => {
      resp.data.on("end", () => {
        if (usage) {
          usage.completion_tokens = completionTokens;
          usage.total_tokens = usage.prompt_tokens + completionTokens;
        }
        res.write("data: [DONE]\n\n");
        res.end();
        resolve({ content: fullContent, usage });
      });
      resp.data.on("error", (err) => {
        res.end();
        reject(err);
      });
      req?.on("close", () => {
        resp.data.destroy();
      });
    });
  }

  const err = new Error("Unsupported AI provider");
  err.status = 500;
  throw err;
}
