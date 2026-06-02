import axios from "axios";
import { createParser } from "eventsource-parser";
import { decryptSecret } from "../utils/encrypt.js";
import { PROVIDER_ROOT, isOpenAiCompatibleProvider } from "../constants/aiProviders.js";
import { forwardChatCompletion } from "../services/aiProxy.js";
import {
  buildForwardPathAndQuery,
  mergeClientHeaders,
  resolveRequestBody,
  isStreamingResponse,
  METHODS_WITH_BODY,
} from "./requestBuild.js";

function isChatCompletionsPath(forwardPath) {
  const p = String(forwardPath || "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return p === "/chat/completions" || p === "/v1/chat/completions" || p.endsWith("/chat/completions");
}

/** Providers that must use aiProxy (not raw HTTP to base + path). */
function useMarketplaceAiProxy(provider) {
  return (
    provider === "gemini" ||
    provider === "anthropic" ||
    isOpenAiCompatibleProvider(provider)
  );
}

const MAX_BODY = Number(process.env.GATEWAY_MAX_BODY_BYTES || 15 * 1024 * 1024);
const PROVIDER_RETRIES = Number(process.env.GATEWAY_PROVIDER_RETRIES || 1);

export function buildProviderUrl(api, forwardPath, search = "") {
  const path = forwardPath.startsWith("/") ? forwardPath : `/${forwardPath}`;
  let base;
  if (api.aiProvider === "custom") {
    base = String(api.customEndpointUrl || api.baseUrl || "").replace(/\/+$/, "");
  } else {
    base = (PROVIDER_ROOT[api.aiProvider] || api.baseUrl || "").replace(/\/+$/, "");
  }
  return `${base}${path}${search || ""}`;
}

export function providerHeaders(api, decryptedKey, clientHeaders = {}) {
  const headers = { ...clientHeaders };
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (!decryptedKey) return headers;

  if (api.authType === "api_key") {
    headers["x-api-key"] = decryptedKey;
    delete headers.Authorization;
  } else if (api.authType === "basic") {
    headers.Authorization = `Basic ${Buffer.from(decryptedKey, "utf8").toString("base64")}`;
  } else if (api.aiProvider === "anthropic") {
    headers["x-api-key"] = decryptedKey;
    headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
    delete headers.Authorization;
  } else {
    headers.Authorization = `Bearer ${decryptedKey}`;
  }
  return headers;
}

function parseSseUsageFromText(text) {
  let total = 0;
  let prompt = 0;
  let completion = 0;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      const u = json?.usage;
      if (u?.total_tokens) {
        total = u.total_tokens;
        prompt = u.prompt_tokens ?? prompt;
        completion = u.completion_tokens ?? completion;
      }
    } catch {
      /* partial chunk */
    }
  }
  if (total > 0) {
    return { prompt, completion, total, source: "provider", fallbackToRequest: false };
  }
  return null;
}

async function axiosWithRetry(config, retries = PROVIDER_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios(config);
    } catch (err) {
      lastErr = err;
      const retryable =
        err.code === "ECONNABORTED" ||
        err.code === "ETIMEDOUT" ||
        (err.response && err.response.status >= 502);
      if (!retryable || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Pipe provider SSE/stream to client; returns usage + timing for billing.
 */
export async function pipeProviderStreamToClient({ api, method, forwardPath, search, req, res, timeoutMs }) {
  let providerKey = null;
  if (api.authHeaderEncrypted) providerKey = decryptSecret(api.authHeaderEncrypted);

  const url = buildProviderUrl(api, forwardPath, search);
  const headers = providerHeaders(
    api,
    providerKey,
    mergeClientHeaders(req, { Accept: "text/event-stream", "Content-Type": "application/json" })
  );
  const data = resolveRequestBody(req, method);
  if (data !== undefined && METHODS_WITH_BODY.has(method)) {
    if (typeof data === "object" && !(data instanceof Buffer)) {
      headers["Content-Type"] = "application/json";
    }
  }

  const started = Date.now();
  let tokenAccumulator = { prompt: null, completion: null, total: null, source: "none", fallbackToRequest: true };

  try {
    const resp = await axiosWithRetry({
      method,
      url,
      headers,
      data: METHODS_WITH_BODY.has(method) ? data : undefined,
      responseType: "stream",
      timeout: timeoutMs || api.timeoutMs || 120000,
      validateStatus: () => true,
      maxContentLength: MAX_BODY,
      maxBodyLength: MAX_BODY,
    });

    providerKey = null;
    const httpStatus = resp.status;

    if (httpStatus >= 500) {
      let errBody = "";
      try {
        errBody = await streamToString(resp.data);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        httpStatus,
        providerError: errBody || `Provider HTTP ${httpStatus}`,
        responseTimeMs: Date.now() - started,
      };
    }

    const contentType = resp.headers["content-type"] || "text/event-stream";
    res.status(httpStatus);
    res.setHeader("Content-Type", contentType);
    if (resp.headers["cache-control"]) res.setHeader("Cache-Control", resp.headers["cache-control"]);
    res.flushHeaders?.();

    const parser = createParser({
      onEvent(event) {
        const usage = parseSseUsageFromText(`data: ${event.data}`);
        if (usage) tokenAccumulator = usage;
      },
    });

    await new Promise((resolve, reject) => {
      resp.data.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        try {
          parser.feed(text);
        } catch {
          /* ignore */
        }
        res.write(chunk);
      });
      resp.data.on("end", resolve);
      resp.data.on("error", reject);
      res.on("close", () => {
        try {
          resp.data.destroy();
        } catch {
          /* ignore */
        }
      });
    });

    res.end();
    return {
      ok: true,
      httpStatus,
      tokens: tokenAccumulator,
      responseTimeMs: Date.now() - started,
      streamed: true,
    };
  } catch (err) {
    providerKey = null;
    return {
      ok: false,
      timeout: err.code === "ECONNABORTED" || err.code === "ETIMEDOUT",
      providerError: err.message,
      responseTimeMs: Date.now() - started,
    };
  }
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

export async function forwardToProvider({ api, method, forwardPath, search, req, timeoutMs, res }) {
  let providerKey = null;
  if (api.authHeaderEncrypted) providerKey = decryptSecret(api.authHeaderEncrypted);

  const started = Date.now();

  if (
    method === "POST" &&
    isChatCompletionsPath(forwardPath) &&
    useMarketplaceAiProxy(api.aiProvider) &&
    providerKey
  ) {
    try {
      const body = resolveRequestBody(req, method) || {};
      const aiRes = await forwardChatCompletion({
        provider: api.aiProvider,
        apiKey: providerKey,
        model: api.modelName || body.model,
        body,
        customEndpointUrl: api.customEndpointUrl || api.baseUrl || "",
      });
      providerKey = null;
      return {
        ok: true,
        status: 200,
        headers: { "content-type": "application/json" },
        data: aiRes,
        responseTimeMs: Date.now() - started,
      };
    } catch (err) {
      providerKey = null;
      return {
        ok: false,
        status: err.status && Number.isFinite(err.status) ? err.status : 502,
        error: err.message,
        providerError: err.message,
        responseTimeMs: Date.now() - started,
      };
    }
  }

  const url = buildProviderUrl(api, forwardPath, search);
  const headers = providerHeaders(api, providerKey, mergeClientHeaders(req, {}));
  const data = resolveRequestBody(req, method);

  try {
    const resp = await axiosWithRetry({
      method,
      url,
      headers,
      data: METHODS_WITH_BODY.has(method) ? data : undefined,
      timeout: timeoutMs || api.timeoutMs || 30000,
      validateStatus: () => true,
      maxContentLength: MAX_BODY,
      maxBodyLength: MAX_BODY,
      responseType: "arraybuffer",
    });
    providerKey = null;

    const contentType = resp.headers["content-type"] || "";
    if (res && isStreamingResponse(contentType)) {
      return pipeProviderStreamToClient({
        api,
        method,
        forwardPath,
        search,
        req,
        res,
        timeoutMs,
      });
    }

    let parsedData = resp.data;
    if (Buffer.isBuffer(parsedData) || parsedData instanceof ArrayBuffer) {
      const buf = Buffer.from(parsedData);
      if (contentType.includes("application/json")) {
        try {
          parsedData = JSON.parse(buf.toString("utf8"));
        } catch {
          parsedData = buf.toString("utf8");
        }
      } else {
        parsedData = buf;
      }
    }

    return {
      ok: true,
      status: resp.status,
      headers: resp.headers,
      data: parsedData,
      rawBuffer: Buffer.isBuffer(resp.data) ? Buffer.from(resp.data) : null,
      responseTimeMs: Date.now() - started,
    };
  } catch (err) {
    providerKey = null;
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return { ok: false, timeout: true, responseTimeMs: Date.now() - started, error: err.message };
    }
    return { ok: false, responseTimeMs: Date.now() - started, error: err.message };
  }
}

export function sendProviderResponse(res, forward, { requestId, actualCostCents, balanceAfter }) {
  res.setHeader("X-Sentinel-Request-Id", requestId);
  res.setHeader("X-Sentinel-Cost", String(actualCostCents));
  res.setHeader("X-Sentinel-Balance", String(balanceAfter));

  if (forward.rawBuffer && !forward.data) {
    if (forward.headers?.["content-type"]) {
      res.setHeader("Content-Type", forward.headers["content-type"]);
    }
    return res.status(forward.status).send(forward.rawBuffer);
  }

  if (forward.headers?.["content-type"]) {
    res.setHeader("Content-Type", forward.headers["content-type"]);
  }

  const payload =
    typeof forward.data === "string" || Buffer.isBuffer(forward.data)
      ? forward.data
      : forward.data;

  if (typeof payload === "string" || Buffer.isBuffer(payload)) {
    return res.status(forward.status).send(payload);
  }
  return res.status(forward.status).json(payload ?? {});
}
