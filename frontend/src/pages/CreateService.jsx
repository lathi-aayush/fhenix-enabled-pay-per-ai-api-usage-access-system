import React from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { chargeForTokens } from "../utils/tokenPricing.js";
import { useTokenEstimate } from "../hooks/useTokenEstimate.js";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import { motion, AnimatePresence } from "framer-motion";

const PROVIDERS = [
  { id: "groq", label: "Groq", desc: "Ultra-fast inference", icon: "electric_bolt" },
  { id: "openai", label: "OpenAI", desc: "GPT-4o & GPT-4o-mini", icon: "token" },
  { id: "anthropic", label: "Anthropic", desc: "Claude 3.5 Sonnet", icon: "spa" },
  { id: "together", label: "Together AI", desc: "Open-source models", icon: "hub" },
  { id: "custom", label: "Custom / Self-Hosted", desc: "Your fine-tuned or hosted model", icon: "deployed_code" },
];

const POPULAR_MODELS = {
  groq: [
    { name: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { name: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    { name: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    { name: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  openai: [
    { name: "gpt-4o", label: "GPT-4o" },
    { name: "gpt-4o-mini", label: "GPT-4o Mini" },
    { name: "o1-mini", label: "o1 Mini" },
  ],
  anthropic: [
    { name: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { name: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { name: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  together: [
    { name: "meta-llama/Llama-3-70b-chat-hf", label: "Llama 3 70B Chat" },
    { name: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
  ],
};

const EXAMPLE_TOKEN_LEVELS = [100, 500, 2000];

export default function CreateService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerThousandTokens, setPricePerThousandTokens] = useState("");
  const [minimumChargeAlgo, setMinimumChargeAlgo] = useState("0.001");
  const [aiProvider, setAiProvider] = useState("groq");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [modelName, setModelName] = useState("llama-3.3-70b-versatile");
  const [x402Enabled, setX402Enabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [customEndpointUrl, setCustomEndpointUrl] = useState("");

  const [providerCostPerThousand, setProviderCostPerThousand] = useState("");
  const [profitMarginPercent, setProfitMarginPercent] = useState("30");
  const [samplePromptText, setSamplePromptText] = useState("");

  const pptNum = parseFloat(pricePerThousandTokens);
  const minNum = parseFloat(minimumChargeAlgo);
  const { estimatedAlgo, minApplies } = useTokenEstimate(
    samplePromptText,
    Number.isFinite(pptNum) ? pptNum : 0,
    Number.isFinite(minNum) ? minNum : 0
  );

  const suggestedPrice = useMemo(() => {
    const cost = parseFloat(providerCostPerThousand);
    const margin = parseFloat(profitMarginPercent);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin)) return null;
    return Math.round(cost * (1 + margin / 100) * 1e6) / 1e6;
  }, [providerCostPerThousand, profitMarginPercent]);

  const previews = useMemo(() => {
    if (!Number.isFinite(pptNum) || !Number.isFinite(minNum)) return [];
    return EXAMPLE_TOKEN_LEVELS.map((tokens) => ({
      tokens,
      algo: chargeForTokens(tokens, pptNum, minNum),
    }));
  }, [pptNum, minNum]);

  function applySuggestedPrice() {
    if (suggestedPrice == null) return;
    setPricePerThousandTokens(String(suggestedPrice));
    toast.success("Applied suggested price per 1k tokens");
  }

  function handleSelectProvider(providerId) {
    setAiProvider(providerId);
    const defaultModel = POPULAR_MODELS[providerId]?.[0]?.name || "";
    setModelName(defaultModel);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const ppt = parseFloat(pricePerThousandTokens);
    const minC = parseFloat(minimumChargeAlgo);
    if (!title.trim() || !Number.isFinite(ppt) || ppt < 0) {
      toast.error("Valid title and price per thousand tokens required");
      return;
    }
    if (!Number.isFinite(minC) || minC < 0.000001) {
      toast.error("Minimum charge must be at least 0.000001 ALGO");
      return;
    }
    if (!providerApiKey.trim() || !modelName.trim()) {
      toast.error("Provider API key and model name are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/services", {
        title: title.trim(),
        description,
        pricePerThousandTokens: ppt,
        minimumChargeAlgo: minC,
        aiProvider,
        providerApiKey: providerApiKey.trim(),
        modelName: modelName.trim(),
        x402Enabled,
        customEndpointUrl: aiProvider === "custom" ? customEndpointUrl.trim() : undefined,
      });
      toast.success("Service published — your key is encrypted on the server");
      navigate("/creator");
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (Array.isArray(d?.errors) && d.errors.map((x) => x.msg).join(" ")) ||
        d?.error ||
        "Failed to create";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const getProviderStyle = (id, active) => {
    const styles = {
      groq: active 
        ? "border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/10 shadow-sm" 
        : "border-slate-200/80 hover:border-orange-300 hover:bg-orange-50/10",
      openai: active 
        ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/10 shadow-sm" 
        : "border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/10",
      anthropic: active 
        ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/10 shadow-sm" 
        : "border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/10",
      together: active 
        ? "border-fuchsia-500 bg-fuchsia-50/60 ring-2 ring-fuchsia-500/10 shadow-sm" 
        : "border-slate-200/80 hover:border-fuchsia-300 hover:bg-fuchsia-50/10",
      custom: active
        ? "border-violet-500 bg-violet-50/60 ring-2 ring-violet-500/10 shadow-sm"
        : "border-slate-200/80 hover:border-violet-300 hover:bg-violet-50/10",
    };
    return styles[id] || "";
  };

  const getProviderIconColor = (id) => {
    const colors = {
      groq: "text-orange-600 bg-orange-100/60",
      openai: "text-emerald-600 bg-emerald-100/60",
      anthropic: "text-amber-600 bg-amber-100/60",
      together: "text-fuchsia-600 bg-fuchsia-100/60",
      custom: "text-violet-600 bg-violet-100/60",
    };
    return colors[id] || "text-slate-600 bg-slate-100";
  };

  return (
    <div className="min-h-screen bg-[#fafafc] selection:bg-indigo-50 selection:text-indigo-900 font-body text-slate-800 antialiased relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg className="absolute inset-0 w-full h-full stroke-slate-200/30 [mask-image:linear-gradient(to_bottom,white_20%,transparent_90%)]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern-full" width="40" height="40" patternUnits="userSpaceOnUse" x="50%" y="-1">
              <path d="M.5 40V.5H40" fill="none" strokeDasharray="3 3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern-full)" />
        </svg>
        <div className="absolute top-[-10%] left-[-15%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-indigo-300/[0.08] blur-[120px] animate-blob" />
        <div className="absolute top-[40%] right-[-10%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-fuchsia-300/[0.06] blur-[130px] animate-blob animation-delay-2000" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-md border-b border-slate-200/60 px-6 h-16 flex items-center justify-between">
        <Link to="/creator" className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <ProfileDropdown />
        </div>
      </header>

      <main className="pt-24 px-6 max-w-xl mx-auto pb-16 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-indigo-600 text-[28px] bg-indigo-50 border border-indigo-100/50 p-1.5 rounded-2xl shadow-sm">
            cloud_queue
          </span>
          <div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
              New AI Endpoint
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-semibold">AI Studio Creation Portal</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-2 mb-8 leading-relaxed">
          Deploy and monetize your custom AI models on the decentralized marketplace. Users pay securely per token consumed, routed directly through the Algorand blockchain.
        </p>

        <form onSubmit={onSubmit} className="space-y-6 bg-white/70 backdrop-blur-md border border-slate-200/80 p-8 rounded-3xl shadow-xl flex flex-col gap-6">
          
          {/* Service Title */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">label</span>
              Title
            </label>
            <div className="relative">
              <input
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sentinel Llama Chat Agent"
                required
              />
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                title
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">description</span>
              Description
            </label>
            <textarea
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all min-h-[100px] placeholder:text-slate-400 leading-relaxed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this AI endpoint does, its specialization, and usage parameters..."
            />
          </div>

          {/* AI Provider (Card-based selection grid) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map((provider) => {
                const isActive = aiProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleSelectProvider(provider.id)}
                    className={`flex flex-col items-start text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer relative ${getProviderStyle(provider.id, isActive)}`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`material-symbols-outlined text-[18px] p-1.5 rounded-xl ${getProviderIconColor(provider.id)}`}>
                        {provider.icon}
                      </span>
                      {isActive && (
                        <span className="material-symbols-outlined text-indigo-600 text-[18px] bg-indigo-50/60 p-0.5 rounded-full">
                          check_circle
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-900">{provider.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">{provider.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Endpoint URL — only shown when "custom" provider is selected */}
          <AnimatePresence>
            {aiProvider === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Explainer box */}
                  <div className="flex items-start gap-3 bg-violet-50/60 border border-violet-200/60 rounded-2xl p-4">
                    <span className="material-symbols-outlined text-violet-600 text-[20px] mt-0.5 shrink-0">
                      info
                    </span>
                    <div>
                      <p className="text-xs font-bold text-violet-900">How custom / self-hosted works</p>
                      <p className="text-[11px] text-violet-700 mt-1 leading-relaxed">
                        Sentinel proxies requests using the{" "}
                        <span className="font-mono bg-violet-100 px-1 rounded">OpenAI chat completions</span>{" "}
                        protocol. Any framework that exposes{" "}
                        <span className="font-mono bg-violet-100 px-1 rounded">/v1/chat/completions</span> works.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {["vLLM", "Ollama", "HuggingFace TGI", "RunPod", "LM Studio", "Replicate"].map((f) => (
                          <span key={f} className="text-[10px] font-bold text-violet-700 bg-violet-100 border border-violet-200/60 px-2 py-0.5 rounded-lg">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* URL input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">link</span>
                      Your Model Base URL
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-500 transition-all placeholder:text-slate-400"
                        value={customEndpointUrl}
                        onChange={(e) => setCustomEndpointUrl(e.target.value)}
                        placeholder="https://your-server.com/v1"
                        required={aiProvider === "custom"}
                      />
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                        deployed_code
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold pl-1">
                      Sentinel will call:{" "}
                      <span className="font-mono text-slate-500">
                        {(customEndpointUrl.replace(/\/+$/, "") || "https://your-server.com/v1") + "/chat/completions"}
                      </span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Provider API Key (with visibility toggle) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">vpn_key</span>
                Provider API Key
              </label>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/40 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">lock</span>
                Encrypted at rest
              </span>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                autoComplete="off"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                value={providerApiKey}
                onChange={(e) => setProviderApiKey(e.target.value)}
                placeholder="Never shown again after saving"
                required
              />
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                key
              </span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center p-0.5"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showApiKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Model Name & Popular Model tag pills */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">settings</span>
              Model Name
            </label>
            <div className="relative">
              <input
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. llama-3.3-70b-versatile, gpt-4o, claude-3-5-sonnet"
                required
              />
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                terminal
              </span>
            </div>

            {/* Popular models suggestions tag pills */}
            <div className="pt-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[12px]">star</span>
                Popular Models for {PROVIDERS.find((p) => p.id === aiProvider)?.label || "Selected Provider"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_MODELS[aiProvider]?.map((model) => {
                  const isCurrent = modelName === model.name;
                  return (
                    <button
                      key={model.name}
                      type="button"
                      onClick={() => setModelName(model.name)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                          : "bg-white border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {model.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* iOS-style toggle switch for x402 Keyless payments */}
          <div className="flex items-center justify-between bg-slate-50/40 border border-slate-200/60 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-indigo-600 text-[20px] mt-0.5 bg-indigo-50 p-1 rounded-lg border border-indigo-100/40">
                verified
              </span>
              <div className="pr-4">
                <label htmlFor="x402ToggleBtn" className="text-xs font-bold text-slate-700 cursor-pointer block">
                  Enable x402 (Keyless Payment Support)
                </label>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                  Allows client applications to make calls keylessly by routing micro-payments directly.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="x402ToggleBtn"
              onClick={() => setX402Enabled(!x402Enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                x402Enabled ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  x402Enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Profit Helper Component */}
          <div className="border border-dashed border-slate-200 bg-slate-50/30 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-indigo-600 text-[18px]">
                calculate
              </span>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Profit Helper</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal font-semibold">
              Enter your raw cost per 1k tokens from the AI provider and target margin. We'll generate a suggested retail list price.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">payments</span>
                  Cost / 1k tokens (ALGO)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={providerCostPerThousand}
                  onChange={(e) => setProviderCostPerThousand(e.target.value)}
                  placeholder="e.g. 0.005"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">percent</span>
                  Profit Margin
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={profitMarginPercent}
                  onChange={(e) => setProfitMarginPercent(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
            {suggestedPrice != null && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/40">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Suggested price / 1k tokens:</span>
                  <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-xl">
                    {suggestedPrice.toFixed(6)} ALGO
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm hover:shadow-indigo-500/10 transition-all cursor-pointer"
                >
                  Apply to form
                </button>
              </div>
            )}
          </div>

          {/* Pricing Config (Price / 1k tokens, Minimum charge) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">payments</span>
                Price / 1k tokens (ALGO)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={pricePerThousandTokens}
                  onChange={(e) => setPricePerThousandTokens(e.target.value)}
                  placeholder="0.010000"
                  required
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                  generating_tokens
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">toll</span>
                Minimum per call (ALGO)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={minimumChargeAlgo}
                  onChange={(e) => setMinimumChargeAlgo(e.target.value)}
                  placeholder="0.001000"
                  required
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                  payments
                </span>
              </div>
            </div>
          </div>

          {/* Sample user prompt (live cost preview) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">find_in_page</span>
              Sample user prompt (live cost preview)
            </label>
            <div className="relative">
              <textarea
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all min-h-[88px] placeholder:text-slate-400 leading-relaxed"
                value={samplePromptText}
                onChange={(e) => setSamplePromptText(e.target.value)}
                placeholder="Type text as if a user were calling your API — estimate updates as you type."
              />
              <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-slate-400 text-[16px]">
                spellcheck
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-2 bg-emerald-50/60 border border-emerald-100/40 px-3.5 py-2 rounded-xl w-fit">
              <span className="material-symbols-outlined text-emerald-600 text-[16px]">payments</span>
              <span className="text-[11px] text-slate-600 font-semibold">Estimated call cost:</span>
              <span className="font-mono text-xs font-extrabold text-emerald-700">
                {estimatedAlgo.toFixed(6)} ALGO
              </span>
              {minApplies && (
                <span className="text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200/40 px-2 py-0.5 rounded-md ml-1">
                  Minimum charge applies
                </span>
              )}
            </div>
          </div>

          {/* Example charges preview list */}
          <AnimatePresence>
            {previews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-200 bg-slate-50/20 p-4 shadow-sm overflow-hidden"
              >
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-indigo-500">list_alt</span>
                  Example charges at your rate
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 font-mono">
                  {previews.map((p) => (
                    <li key={p.tokens} className="flex justify-between items-center bg-white/40 px-3 py-2 rounded-xl border border-slate-100">
                      <span className="font-semibold text-slate-600">~{p.tokens} tokens</span>
                      <span className="text-indigo-600 font-bold">{p.algo.toFixed(6)} ALGO</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Action */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/creator"
              className="inline-flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-slate-900 to-indigo-950 hover:from-indigo-600 hover:to-indigo-500 text-white px-6 py-3 rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting && (
                <span className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? "Publishing service…" : "Publish service"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
