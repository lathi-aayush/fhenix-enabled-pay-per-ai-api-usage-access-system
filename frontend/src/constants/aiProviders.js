/** Marketplace providers — keep in sync with backend/src/constants/aiProviders.js */

export const MARKETPLACE_PROVIDERS = [
  { id: "groq", label: "Groq", desc: "Ultra-fast inference", icon: "electric_bolt", needsBaseUrl: false },
  { id: "openai", label: "OpenAI", desc: "GPT-4o & GPT-4o-mini", icon: "token", needsBaseUrl: false },
  { id: "anthropic", label: "Anthropic", desc: "Claude 3.5+", icon: "spa", needsBaseUrl: false },
  { id: "gemini", label: "Google Gemini", desc: "Gemini API (AI Studio key)", icon: "auto_awesome", needsBaseUrl: false },
  { id: "together", label: "Together AI", desc: "Open models hub", icon: "hub", needsBaseUrl: false },
  { id: "openrouter", label: "OpenRouter", desc: "100+ models, one key", icon: "route", needsBaseUrl: false },
  { id: "mistral", label: "Mistral AI", desc: "Mistral & Codestral", icon: "cyclone", needsBaseUrl: false },
  { id: "deepseek", label: "DeepSeek", desc: "DeepSeek chat models", icon: "psychology", needsBaseUrl: false },
  { id: "fireworks", label: "Fireworks AI", desc: "Fast open-weight hosting", icon: "local_fire_department", needsBaseUrl: false },
  { id: "xai", label: "xAI (Grok)", desc: "Grok API", icon: "rocket_launch", needsBaseUrl: false },
  { id: "perplexity", label: "Perplexity", desc: "Sonar search models", icon: "travel_explore", needsBaseUrl: false },
  {
    id: "custom",
    label: "Custom / Self-Hosted",
    desc: "vLLM, Ollama, RunPod, your proxy",
    icon: "deployed_code",
    needsBaseUrl: true,
  },
];

export const POPULAR_MODELS = {
  groq: [
    { name: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { name: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    { name: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  ],
  openai: [
    { name: "gpt-4o", label: "GPT-4o" },
    { name: "gpt-4o-mini", label: "GPT-4o Mini" },
    { name: "o1-mini", label: "o1 Mini" },
  ],
  anthropic: [
    { name: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { name: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  gemini: [
    { name: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { name: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { name: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  together: [
    { name: "meta-llama/Llama-3-70b-chat-hf", label: "Llama 3 70B" },
    { name: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
  ],
  openrouter: [
    { name: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    { name: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    { name: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  ],
  mistral: [
    { name: "mistral-large-latest", label: "Mistral Large" },
    { name: "codestral-latest", label: "Codestral" },
  ],
  deepseek: [
    { name: "deepseek-chat", label: "DeepSeek Chat" },
    { name: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
  fireworks: [
    { name: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B" },
  ],
  xai: [{ name: "grok-2-latest", label: "Grok 2" }],
  perplexity: [
    { name: "sonar", label: "Sonar" },
    { name: "sonar-pro", label: "Sonar Pro" },
  ],
};

export const API_KEY_HINTS = {
  groq: "Groq API key (gsk_…)",
  openai: "OpenAI API key (sk-…)",
  anthropic: "Anthropic API key",
  gemini: "Google AI Studio API key (AIza…)",
  together: "Together API key",
  openrouter: "OpenRouter API key",
  mistral: "Mistral API key",
  deepseek: "DeepSeek API key",
  fireworks: "Fireworks API key (fw_…)",
  xai: "xAI API key",
  perplexity: "Perplexity API key (pplx-…)",
  custom: "Bearer token your server expects",
};
