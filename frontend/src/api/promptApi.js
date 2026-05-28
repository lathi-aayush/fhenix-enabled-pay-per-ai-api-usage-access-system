import { getApiBase } from "./client.js";

function getToken() {
  return localStorage.getItem("sentinal_token");
}

function friendlyError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("quota exceeded") || msg.includes("403")) {
    return "Monthly prompt limit reached. Upgrade your Studio plan to continue.";
  }
  if (msg.includes("401") || msg.includes("Unauthorized")) {
    return "Sign in to use the Prompt Generator.";
  }
  return msg.slice(0, 200) || "Request failed. Please retry.";
}

async function readSseStream(res, onChunk) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const j = JSON.parse(raw);
        if (j.text) {
          full = j.text;
          onChunk?.(j.text, full);
        }
        if (j.error) throw new Error(j.error);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return full;
}

async function postStream(path, body, onChunk) {
  const base = getApiBase();
  const token = getToken();
  const res = await fetch(`${base}/api/studio${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return readSseStream(res, onChunk);
}

async function postJson(path, body) {
  const base = getApiBase();
  const token = getToken();
  const res = await fetch(`${base}/api/studio${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function generatePrompt(payload, onChunk) {
  return postStream("/prompt/generate", payload, onChunk);
}

export async function enhancePrompt(prompt, onChunk) {
  return postStream("/prompt/enhance", { prompt }, onChunk);
}

export async function improvePrompt(prompt, onChunk) {
  return postStream("/prompt/improve", { prompt }, onChunk);
}

export async function analyzePrompt(prompt) {
  const { analysis } = await postJson("/prompt/analyze", { prompt });
  return analysis;
}

export async function generateVariations(prompt, count = 3) {
  const { text } = await postJson("/prompt/variations", { prompt, count });
  return text;
}

export { friendlyError };
