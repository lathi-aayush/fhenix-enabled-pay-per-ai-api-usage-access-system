/**
 * Marketplace AI providers — fixed upstream URLs (no creator base URL except custom).
 */
export const AI_PROVIDERS = [
  "groq",
  "openai",
  "anthropic",
  "together",
  "gemini",
  "openrouter",
  "mistral",
  "deepseek",
  "fireworks",
  "xai",
  "perplexity",
  "custom",
];

/** OpenAI-compatible POST .../chat/completions (Bearer auth). */
export const OPENAI_COMPAT_CHAT_URL = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  fireworks: "https://api.fireworks.ai/inference/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};

export const PROVIDER_ROOT = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  together: "https://api.together.xyz/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com",
  fireworks: "https://api.fireworks.ai/inference/v1",
  xai: "https://api.x.ai/v1",
  perplexity: "https://api.perplexity.ai",
};

export function isOpenAiCompatibleProvider(provider) {
  return Boolean(OPENAI_COMPAT_CHAT_URL[provider]);
}

export function requiresCustomBaseUrl(provider) {
  return provider === "custom";
}

export function isSupportedProvider(provider) {
  return AI_PROVIDERS.includes(provider);
}

export function providerCategory(aiProvider) {
  const map = {
    openai: "ai",
    anthropic: "ai",
    groq: "ai",
    together: "ai",
    gemini: "ai",
    openrouter: "ai",
    mistral: "ai",
    deepseek: "ai",
    fireworks: "ai",
    xai: "ai",
    perplexity: "ai",
    custom: "ai",
  };
  return map[aiProvider] || "ai";
}

/** Optional extra headers for some OpenAI-compatible gateways. */
export function openAiCompatExtraHeaders(provider) {
  if (provider === "openrouter") {
    return {
      "HTTP-Referer": process.env.OPENROUTER_REFERER_URL || "https://sentinalai.dev",
      "X-Title": process.env.OPENROUTER_APP_TITLE || "Sentinel AI Marketplace",
    };
  }
  return {};
}
